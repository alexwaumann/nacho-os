// Pure route and coordinate helpers, safe to import from both Convex functions and the browser

export type Coordinates = {
  lat: number;
  lng: number;
};

export type PlaceSuggestion = {
  label: string;
  placeId: string;
  mainText?: string;
  secondaryText?: string;
};

export type RouteWaypoint = {
  coordinates: Coordinates;
  address: string;
};

export type RouteMetrics = {
  distance: string;
  duration: string;
  distanceValue: number;
  durationValue: number;
};

export type OptimizedRoute = {
  orderedWaypoints: Array<RouteWaypoint>;
  waypointOrder: Array<number>;
  metrics: Array<RouteMetrics>;
  overviewPolyline: string;
  totalDistance: string;
  totalDuration: string;
};

export type CalculatedRouteMetrics = {
  metrics: Array<RouteMetrics>;
  totalDistance: string;
  totalDuration: string;
  totalDistanceValue: number;
  totalDurationValue: number;
  // The drive from the last stop home, when a home address was given
  homeLeg: RouteMetrics | undefined;
};

export interface RouteLeg {
  distanceMeters?: number;
  duration?: string;
}

// Google omits zero-valued fields, so a leg that starts at the stop has no distanceMeters
export function normalizeLeg(leg: RouteLeg): Required<RouteLeg> {
  return { distanceMeters: leg.distanceMeters ?? 0, duration: leg.duration ?? "0s" };
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return `${Math.round(miles * 10) / 10} mi`;
}

export function formatDuration(duration: string): string {
  // Duration comes as "123s" format
  const seconds = parseInt(duration.replace("s", ""), 10);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

export function parseDuration(duration: string): number {
  return parseInt(duration.replace("s", ""), 10);
}

export function toRouteMetrics(rawLeg: RouteLeg): RouteMetrics {
  const leg = normalizeLeg(rawLeg);
  return {
    distance: formatDistance(leg.distanceMeters),
    duration: formatDuration(leg.duration),
    distanceValue: leg.distanceMeters,
    durationValue: parseDuration(leg.duration),
  };
}

/**
 * Google returns [-1] when no reordering happened (e.g. a single stop), so only trust the
 * optimized order when it's a full permutation of the waypoints
 */
export function resolveWaypointOrder(
  waypointCount: number,
  optimizedOrder: Array<number> | undefined,
): Array<number> {
  const identityOrder = Array.from({ length: waypointCount }, (_, i) => i);
  const isValidOrder =
    optimizedOrder?.length === waypointCount &&
    identityOrder.every((i) => optimizedOrder.includes(i));
  return isValidOrder ? optimizedOrder : identityOrder;
}

/**
 * Calculate distance between two coordinates in km (Haversine formula)
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
