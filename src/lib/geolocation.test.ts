import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOCATION_ERROR,
  LocationError,
  NATIVE_MIN_TIMEOUT,
  getCurrentLocation,
  requestLocationPermission,
  resetNativeLocationCache,
  watchLocationPermission,
} from "./geolocation";

const mocks = vi.hoisted(() => ({
  isNative: true,
  plugins: new Set(["Geolocation", "App"]),
  getCurrentPosition: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNative,
    isPluginAvailable: (name: string) => mocks.plugins.has(name),
  },
}));
vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    getCurrentPosition: mocks.getCurrentPosition,
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
  },
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: mocks.addListener } }));
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: { hide: vi.fn() } }));

const WACO = { lat: 31.5493, lng: -97.1467 };
const position = (lat: number, lng: number) => ({
  coords: { latitude: lat, longitude: lng },
  timestamp: Date.now(),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 3, 9, 0));
  mocks.isNative = true;
  mocks.getCurrentPosition.mockReset();
  mocks.checkPermissions.mockReset();
  mocks.requestPermissions.mockReset();
  mocks.addListener.mockReset();
  resetNativeLocationCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getCurrentLocation in the iOS app", () => {
  it("returns the cached fix within maximumAge", async () => {
    mocks.getCurrentPosition.mockResolvedValue(position(WACO.lat, WACO.lng));
    await expect(getCurrentLocation({ maximumAge: 60000 })).resolves.toEqual(WACO);

    vi.advanceTimersByTime(59000);
    await expect(getCurrentLocation({ maximumAge: 60000 })).resolves.toEqual(WACO);
    expect(mocks.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("asks for a new fix once the cached one is older than maximumAge", async () => {
    mocks.getCurrentPosition
      .mockResolvedValueOnce(position(WACO.lat, WACO.lng))
      .mockResolvedValueOnce(position(32, -97));
    await getCurrentLocation({ maximumAge: 30000 });

    vi.advanceTimersByTime(30001);
    await expect(getCurrentLocation({ maximumAge: 30000 })).resolves.toEqual({
      lat: 32,
      lng: -97,
    });
    expect(mocks.getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("always asks for a fresh fix with maximumAge 0 or unset, like the browser", async () => {
    mocks.getCurrentPosition.mockResolvedValue(position(WACO.lat, WACO.lng));
    await getCurrentLocation({ maximumAge: 60000 });
    await getCurrentLocation({ maximumAge: 0 });
    await getCurrentLocation();
    expect(mocks.getCurrentPosition).toHaveBeenCalledTimes(3);
  });

  it("shares one plugin call between overlapping requests", async () => {
    const fix = deferred<ReturnType<typeof position>>();
    mocks.getCurrentPosition.mockReturnValue(fix.promise);

    const first = getCurrentLocation({ maximumAge: 30000 });
    const second = getCurrentLocation({ maximumAge: 0 });
    fix.resolve(position(WACO.lat, WACO.lng));

    await expect(Promise.all([first, second])).resolves.toEqual([WACO, WACO]);
    expect(mocks.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("starts a new plugin call after a failed one", async () => {
    mocks.getCurrentPosition
      .mockRejectedValueOnce({ code: "OS-PLUG-GLOC-0010", message: "Timed out" })
      .mockResolvedValueOnce(position(WACO.lat, WACO.lng));
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: LOCATION_ERROR.TIMEOUT });
    await expect(getCurrentLocation()).resolves.toEqual(WACO);
    expect(mocks.getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("waits at least NATIVE_MIN_TIMEOUT for a fix", async () => {
    mocks.getCurrentPosition.mockResolvedValue(position(WACO.lat, WACO.lng));
    await getCurrentLocation({ enableHighAccuracy: true, timeout: 10000 });
    await getCurrentLocation();
    await getCurrentLocation({ timeout: 30000 });

    const timeouts = mocks.getCurrentPosition.mock.calls.map(([options]) => options.timeout);
    expect(timeouts).toEqual([NATIVE_MIN_TIMEOUT, NATIVE_MIN_TIMEOUT, 30000]);
    expect(mocks.getCurrentPosition.mock.calls[0][0].enableHighAccuracy).toBe(true);
  });

  it("maps plugin error codes onto browser codes", async () => {
    const cases = [
      ["OS-PLUG-GLOC-0003", LOCATION_ERROR.PERMISSION_DENIED, false],
      ["OS-PLUG-GLOC-0007", LOCATION_ERROR.PERMISSION_DENIED, true],
      ["OS-PLUG-GLOC-0008", LOCATION_ERROR.PERMISSION_DENIED, false],
      ["OS-PLUG-GLOC-0010", LOCATION_ERROR.TIMEOUT, false],
      ["OS-PLUG-GLOC-0002", LOCATION_ERROR.POSITION_UNAVAILABLE, false],
    ] as const;
    for (const [nativeCode, code, isServicesOff] of cases) {
      mocks.getCurrentPosition.mockRejectedValueOnce({ code: nativeCode, message: "failed" });
      const error = await getCurrentLocation().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(LocationError);
      expect(error).toMatchObject({ code, isServicesOff, message: "failed" });
    }
  });
});

describe("getCurrentLocation in the browser", () => {
  beforeEach(() => {
    mocks.isNative = false;
  });

  it("passes the caller's options straight to navigator.geolocation", async () => {
    const browserGetPosition = vi.fn((resolve: PositionCallback) =>
      resolve(position(WACO.lat, WACO.lng) as unknown as GeolocationPosition),
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: browserGetPosition } });

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 };
    await expect(getCurrentLocation(options)).resolves.toEqual(WACO);
    await getCurrentLocation(options);

    expect(browserGetPosition).toHaveBeenCalledTimes(2);
    expect(browserGetPosition.mock.calls[0][2]).toBe(options);
    expect(mocks.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("keeps the browser's error code", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_: PositionCallback, reject: PositionErrorCallback) =>
          reject({ code: 3, message: "Timeout expired" } as GeolocationPositionError),
      },
    });
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: LOCATION_ERROR.TIMEOUT,
      isServicesOff: false,
    });
  });
});

describe("requestLocationPermission", () => {
  it("uses the iOS prompt in the app, without waiting for a fix", async () => {
    mocks.requestPermissions.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    await expect(requestLocationPermission()).resolves.toBe("granted");
    mocks.requestPermissions.mockResolvedValue({ location: "denied", coarseLocation: "denied" });
    await expect(requestLocationPermission()).resolves.toBe("denied");
    expect(mocks.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("reports Location Services off in the app", async () => {
    mocks.requestPermissions.mockRejectedValue({ code: "OS-PLUG-GLOC-0007", message: "off" });
    await expect(requestLocationPermission()).resolves.toBe("services-off");
  });

  it("asks for a position in the browser; only a refusal means denied", async () => {
    mocks.isNative = false;
    let errorCode = 1;
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_: PositionCallback, reject: PositionErrorCallback) =>
          reject({ code: errorCode, message: "failed" } as GeolocationPositionError),
      },
    });
    await expect(requestLocationPermission()).resolves.toBe("denied");
    errorCode = 3;
    await expect(requestLocationPermission()).rejects.toMatchObject({
      code: LOCATION_ERROR.TIMEOUT,
    });
  });
});

describe("watchLocationPermission in the app", () => {
  it("checks again when the app comes back to the foreground", async () => {
    const remove = vi.fn();
    let onAppState: (state: { isActive: boolean }) => void = () => {};
    mocks.addListener.mockImplementation((_event: string, listener: typeof onAppState) => {
      onAppState = listener;
      return Promise.resolve({ remove });
    });
    mocks.checkPermissions.mockResolvedValueOnce({ location: "prompt" });
    const onChange = vi.fn();

    const stop = watchLocationPermission(onChange);
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith("prompt"));

    mocks.checkPermissions.mockRejectedValueOnce({ code: "OS-PLUG-GLOC-0007", message: "off" });
    onAppState({ isActive: true });
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith("services-off"));

    onAppState({ isActive: false });
    expect(mocks.checkPermissions).toHaveBeenCalledTimes(2);

    stop();
    await vi.waitFor(() => expect(remove).toHaveBeenCalled());
  });

  it("skips the foreground check in app builds without the App plugin", async () => {
    mocks.plugins.delete("App");
    mocks.checkPermissions.mockResolvedValue({ location: "granted" });
    const onChange = vi.fn();
    watchLocationPermission(onChange);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("granted"));
    expect(mocks.addListener).not.toHaveBeenCalled();
    mocks.plugins.add("App");
  });
});
