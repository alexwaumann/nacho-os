import * as Location from "expo-location";

import type { Coordinates } from "@convex/lib/routing";

/** Why getting his location failed, so the message can say what to do about it */
export type LocationErrorKind = "denied" | "services-off" | "unavailable";

export class LocationError extends Error {
  kind: LocationErrorKind;

  constructor(kind: LocationErrorKind, message: string) {
    super(message);
    this.name = "LocationError";
    this.kind = kind;
  }
}

// A fix older than this is still fine for planning a route from where he is
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * His current location. Asks for permission the first time (iOS shows the prompt from app.json).
 * Uses a recent last-known fix when there is one, so it's quick, and throws a LocationError with a
 * plain-language message otherwise.
 */
export async function getCurrentLocation(): Promise<Coordinates> {
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new LocationError(
      "services-off",
      "Turn on Location Services in Settings > Privacy & Security > Location Services.",
    );
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    throw new LocationError(
      "denied",
      "Allow location in Settings > Nacho OS > Location, then try again.",
    );
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_MAX_AGE_MS,
  });
  if (lastKnown) return toCoordinates(lastKnown);

  try {
    return toCoordinates(
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    );
  } catch {
    throw new LocationError(
      "unavailable",
      "Couldn't find your location. Check your signal, then try again.",
    );
  }
}

/** The message to show when getting his location failed */
export function describeLocationError(error: unknown): string {
  if (error instanceof LocationError) return error.message;
  return "Couldn't find your location. Try again.";
}

/** True when the fix is in the Settings app (permission denied or Location Services off) */
export function isLocationSettingsError(error: unknown): boolean {
  return error instanceof LocationError && error.kind !== "unavailable";
}

function toCoordinates(position: Location.LocationObject): Coordinates {
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}
