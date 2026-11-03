import { Linking } from "react-native";

import { generateGoogleMapsDirectionsUrl, generateGoogleMapsUrl } from "@shared/googleMaps";
import type { Coordinates } from "@convex/lib/routing";

/**
 * Opens a Google Maps link. These are https://www.google.com/maps links, which iOS hands to the
 * Google Maps app when it's installed (he uses it for driving) and to Safari otherwise.
 */
async function openGoogleMaps(url: string) {
  await Linking.openURL(url);
}

/** Driving directions from where he is to one address */
export function openDirectionsTo(address: string) {
  return openGoogleMaps(generateGoogleMapsDirectionsUrl(address));
}

/**
 * Driving directions through all of today's stops in order, ending at home when it's set
 * (otherwise at the last stop). Returns false when no stop has coordinates.
 */
export async function openRouteDirections(
  stops: { coordinates?: Coordinates }[],
  homeCoordinates?: Coordinates,
): Promise<boolean> {
  const url = generateGoogleMapsUrl(stops, true, homeCoordinates);
  if (!url) return false;
  await openGoogleMaps(url);
  return true;
}
