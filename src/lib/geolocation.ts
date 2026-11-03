import { App } from "@capacitor/app";
import { Geolocation } from "@capacitor/geolocation";

import { isNativePluginAvailable } from "./native";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Location permission for the site. "services-off" only comes from the iOS app: Location Services
 * is switched off for the whole phone (Settings > Privacy & Security > Location Services).
 */
export type LocationPermission = "prompt" | "granted" | "denied" | "services-off";

/** Same codes as the browser's `GeolocationPositionError` */
export const LOCATION_ERROR = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;

/** A failed location request, from the browser or the native plugin, with browser error codes */
export class LocationError extends Error {
  code: number;
  /** iOS app only: Location Services is off for the whole phone (code is PERMISSION_DENIED) */
  isServicesOff: boolean;

  constructor(code: number, message: string, isServicesOff = false) {
    super(message);
    this.name = "LocationError";
    this.code = code;
    this.isServicesOff = isServicesOff;
  }
}

// The iOS plugin rejects with "OS-PLUG-GLOC-00xx" codes (see GeolocationError.swift)
const SERVICES_OFF_CODE = "OS-PLUG-GLOC-0007";
const NATIVE_ERROR_CODES: Record<string, number> = {
  "OS-PLUG-GLOC-0003": LOCATION_ERROR.PERMISSION_DENIED, // permission denied
  [SERVICES_OFF_CODE]: LOCATION_ERROR.PERMISSION_DENIED, // Location Services switched off
  "OS-PLUG-GLOC-0008": LOCATION_ERROR.PERMISSION_DENIED, // restricted (e.g. Screen Time)
  "OS-PLUG-GLOC-0010": LOCATION_ERROR.TIMEOUT,
};

function toLocationError(error: unknown): LocationError {
  if (error instanceof LocationError) return error;
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  const text = typeof message === "string" ? message : "Unable to get your location";
  if (typeof code === "number") return new LocationError(code, text);
  const mapped = typeof code === "string" ? NATIVE_ERROR_CODES[code] : undefined;
  return new LocationError(
    mapped ?? LOCATION_ERROR.POSITION_UNAVAILABLE,
    text,
    code === SERVICES_OFF_CODE,
  );
}

/**
 * What to tell him when getting his location failed, worded for where he is: the iOS app points at
 * the Settings app, the browser at its own settings. A timeout or no signal isn't a permission
 * problem, so it just says to try again.
 */
export function describeLocationError(error: unknown): string {
  if (!(error instanceof LocationError)) {
    return error instanceof Error ? error.message : "Unknown error";
  }
  if (error.isServicesOff) {
    return "Turn on Location Services in Settings > Privacy & Security > Location Services.";
  }
  if (error.code === LOCATION_ERROR.PERMISSION_DENIED) {
    return isNativePluginAvailable("Geolocation") ?
        "Allow location in Settings > Nacho OS > Location, then try again."
      : "Location permission is blocked. Allow it in your browser settings.";
  }
  return "Couldn't get your location right now. Please try again.";
}

/**
 * The iOS plugin ignores `maximumAge` (every call is a fresh fix) and gives up after 5 s when no
 * timeout is passed, which a cold GPS often misses. So the app keeps its own last fix, waits at
 * least this long for a new one, and shares one plugin call between overlapping requests.
 */
export const NATIVE_MIN_TIMEOUT = 15000;

let lastNativeFix: { position: LatLng; timestamp: number } | null = null;
let nativeRequest: Promise<LatLng> | null = null;

function getNativeLocation(options: LocationOptions): Promise<LatLng> {
  // Same as the browser: maximumAge 0 (or unset) always asks for a fresh fix
  const maximumAge = options.maximumAge ?? 0;
  if (lastNativeFix && maximumAge > 0 && Date.now() - lastNativeFix.timestamp <= maximumAge) {
    return Promise.resolve(lastNativeFix.position);
  }
  nativeRequest ??= Geolocation.getCurrentPosition({
    enableHighAccuracy: options.enableHighAccuracy,
    timeout: Math.max(options.timeout ?? 0, NATIVE_MIN_TIMEOUT),
  })
    .then((position) => {
      const fix = { lat: position.coords.latitude, lng: position.coords.longitude };
      lastNativeFix = { position: fix, timestamp: Date.now() };
      return fix;
    })
    .catch((error: unknown) => {
      throw toLocationError(error);
    })
    .finally(() => {
      nativeRequest = null;
    });
  return nativeRequest;
}

/** Test helper: forget the cached native fix and any request in flight */
export function resetNativeLocationCache() {
  lastNativeFix = null;
  nativeRequest = null;
}

/**
 * The device's current position. In the iOS shell this goes through the native Geolocation plugin,
 * so iOS asks once and WebKit never shows its own "would like to use your current location"
 * alert; elsewhere it is `navigator.geolocation`. Rejects with a `LocationError`.
 */
export function getCurrentLocation(options: LocationOptions = {}): Promise<LatLng> {
  if (isNativePluginAvailable("Geolocation")) return getNativeLocation(options);

  return new Promise((resolve, reject) => {
    // Defensive check for older browsers/environments
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(toLocationError(error)),
      options,
    );
  });
}

function toPermission(state: string): LocationPermission {
  return state === "granted" || state === "denied" ? state : "prompt";
}

/** Native permission state; Location Services off rejects with 0007, reported as "services-off" */
async function checkNativePermission(
  check: () => Promise<{ location: string }>,
): Promise<LocationPermission> {
  try {
    return toPermission((await check()).location);
  } catch (error) {
    const locationError = toLocationError(error);
    if (locationError.isServicesOff) return "services-off";
    throw locationError;
  }
}

/**
 * Asks for location access. In the iOS app this is the iOS prompt itself, so "granted" doesn't
 * depend on also getting a fix in time. In the browser there is no prompt-only API, so it requests a
 * position: "granted" once one arrives, "denied" when refused. Anything else (timeout, no signal)
 * rejects with a `LocationError`, because it says nothing about the permission.
 */
export async function requestLocationPermission(): Promise<LocationPermission> {
  if (isNativePluginAvailable("Geolocation")) {
    return checkNativePermission(() => Geolocation.requestPermissions());
  }
  try {
    await getCurrentLocation({ enableHighAccuracy: true });
    return "granted";
  } catch (error) {
    if (error instanceof LocationError && error.code === LOCATION_ERROR.PERMISSION_DENIED) {
      return "denied";
    }
    throw error;
  }
}

/**
 * Current location permission, and a callback for later changes. The browser reports changes
 * itself; the iOS plugin doesn't (he changes it in the Settings app), so the app checks again
 * whenever it comes back to the foreground. Returns a cleanup function.
 */
export function watchLocationPermission(onChange: (state: LocationPermission) => void) {
  if (isNativePluginAvailable("Geolocation")) {
    let isCancelled = false;
    const check = () => {
      checkNativePermission(() => Geolocation.checkPermissions())
        .then((state) => {
          if (!isCancelled) onChange(state);
        })
        .catch((error: unknown) => console.warn("Location permission check failed:", error));
    };
    check();
    const listener =
      isNativePluginAvailable("App") ?
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) check();
        })
      : null;
    return () => {
      isCancelled = true;
      listener
        ?.then((handle) => handle.remove())
        .catch((error: unknown) => console.warn("Removing the app state listener failed:", error));
    };
  }

  let status: PermissionStatus | null = null;
  let isCancelled = false;
  const handleChange = () => status && onChange(toPermission(status.state));
  navigator.permissions.query({ name: "geolocation" }).then((result) => {
    if (isCancelled) return;
    status = result;
    onChange(toPermission(result.state));
    result.addEventListener("change", handleChange);
  });
  return () => {
    isCancelled = true;
    status?.removeEventListener("change", handleChange);
  };
}
