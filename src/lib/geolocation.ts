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

export type LocationPermission = "prompt" | "granted" | "denied";

/** Same codes as the browser's `GeolocationPositionError` */
export const LOCATION_ERROR = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;

/** A failed location request, from the browser or the native plugin, with browser error codes */
export class LocationError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "LocationError";
    this.code = code;
  }
}

// The iOS plugin rejects with "OS-PLUG-GLOC-00xx" codes (see GeolocationError.swift)
const NATIVE_ERROR_CODES: Record<string, number> = {
  "OS-PLUG-GLOC-0003": LOCATION_ERROR.PERMISSION_DENIED, // permission denied
  "OS-PLUG-GLOC-0007": LOCATION_ERROR.PERMISSION_DENIED, // Location Services switched off
  "OS-PLUG-GLOC-0008": LOCATION_ERROR.PERMISSION_DENIED, // restricted (e.g. Screen Time)
  "OS-PLUG-GLOC-0010": LOCATION_ERROR.TIMEOUT,
};

function toLocationError(error: unknown): LocationError {
  if (error instanceof LocationError) return error;
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  const text = typeof message === "string" ? message : "Unable to get your location";
  if (typeof code === "number") return new LocationError(code, text);
  const mapped = typeof code === "string" ? NATIVE_ERROR_CODES[code] : undefined;
  return new LocationError(mapped ?? LOCATION_ERROR.POSITION_UNAVAILABLE, text);
}

/**
 * The device's current position. In the iOS shell this goes through the native Geolocation plugin,
 * so iOS asks once and WebKit never shows its own "would like to use your current location"
 * alert; elsewhere it is `navigator.geolocation`. Rejects with a `LocationError`.
 */
export async function getCurrentLocation(options: LocationOptions = {}): Promise<LatLng> {
  if (isNativePluginAvailable("Geolocation")) {
    try {
      const position = await Geolocation.getCurrentPosition(options);
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (error) {
      throw toLocationError(error);
    }
  }

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

/**
 * Current location permission, and a callback for later changes where the browser reports them.
 * Returns a cleanup function.
 */
export function watchLocationPermission(onChange: (state: LocationPermission) => void) {
  if (isNativePluginAvailable("Geolocation")) {
    Geolocation.checkPermissions()
      .then((status) =>
        onChange(status.location === "prompt-with-rationale" ? "prompt" : status.location),
      )
      .catch((error: unknown) => console.warn("Location permission check failed:", error));
    return () => {};
  }

  let status: PermissionStatus | null = null;
  let isCancelled = false;
  const handleChange = () => status && onChange(status.state);
  navigator.permissions.query({ name: "geolocation" }).then((result) => {
    if (isCancelled) return;
    status = result;
    onChange(result.state);
    result.addEventListener("change", handleChange);
  });
  return () => {
    isCancelled = true;
    status?.removeEventListener("change", handleChange);
  };
}
