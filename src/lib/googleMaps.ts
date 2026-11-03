import type { Coordinates } from "../../convex/lib/routing";

/**
 * Generate a Google Maps navigation URL
 *
 * @param waypoints - Array of job waypoints to visit
 * @param useCurrentLocation - If true, uses device's current location as origin
 * @param homeCoordinates - Optional home address to use as final destination
 */
export function generateGoogleMapsUrl(
  waypoints: Array<{ coordinates?: Coordinates }>,
  useCurrentLocation: boolean = true,
  homeCoordinates?: Coordinates,
): string | null {
  const validPoints = waypoints.filter(
    (p): p is { coordinates: Coordinates } => p.coordinates !== undefined,
  );

  // Need at least 1 waypoint (will navigate from current location to that point)
  if (validPoints.length === 0) return null;

  let origin = "";
  let destination = "";
  let waypointsList: Array<{ coordinates: Coordinates }> = [];

  if (useCurrentLocation) {
    // Leave origin blank for "My Location"
    origin = "";

    if (homeCoordinates) {
      // Home address is set - all jobs are waypoints, home is final destination
      waypointsList = validPoints;
      destination = `${homeCoordinates.lat},${homeCoordinates.lng}`;
    } else {
      // No home address - all jobs except last are waypoints, last job is destination
      waypointsList = validPoints.slice(0, -1);
      const end = validPoints[validPoints.length - 1];
      destination = `${end.coordinates.lat},${end.coordinates.lng}`;
    }
  } else {
    const start = validPoints[0];
    if (homeCoordinates) {
      // First point is origin, all others are waypoints, home is destination
      origin = `${start.coordinates.lat},${start.coordinates.lng}`;
      waypointsList = validPoints.slice(1);
      destination = `${homeCoordinates.lat},${homeCoordinates.lng}`;
    } else {
      // First point is origin, middle points are waypoints, last is destination
      origin = `${start.coordinates.lat},${start.coordinates.lng}`;
      const end = validPoints[validPoints.length - 1];
      destination = `${end.coordinates.lat},${end.coordinates.lng}`;
      waypointsList = validPoints.slice(1, -1);
    }
  }

  let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

  if (origin) {
    url += `&origin=${origin}`;
  }

  if (waypointsList.length > 0) {
    const waypointStr = waypointsList
      .map((p) => `${p.coordinates.lat},${p.coordinates.lng}`)
      .join("|");
    url += `&waypoints=${waypointStr}`;
  }

  return url;
}
