import { env } from "../env";
import { formatDistance, formatDuration, resolveWaypointOrder, toRouteMetrics } from "./routing";
import type {
  CalculatedRouteMetrics,
  Coordinates,
  OptimizedRoute,
  PlaceSuggestion,
  RouteLeg,
  RouteMetrics,
  RouteWaypoint,
} from "./routing";

export type { Coordinates } from "./routing";

const COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

function toLocation(coordinates: Coordinates) {
  return {
    location: {
      latLng: {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      },
    },
  };
}

/**
 * Geocode an address to coordinates using Google Geocoding API
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${env.GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const result = await response.json();

  if (result.status === "OK" && result.results.length > 0) {
    const location = result.results[0].geometry.location;
    return {
      lat: location.lat,
      lng: location.lng,
    } as Coordinates;
  }

  // Attempt 2: Retry with cleaned address (removing units, suites, etc.)
  const cleanedAddress = address
    .replace(/[,]?\s*(?:unit|suite|apt|apartment|room|bldg|building|floor)\s*[\w\d-]+/gi, "")
    .replace(/[,]?\s*#[\w\d-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanedAddress !== address && cleanedAddress.length > 5) {
    const cleanedUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanedAddress)}&key=${env.GOOGLE_MAPS_API_KEY}`;
    const cleanedResponse = await fetch(cleanedUrl);
    const cleanedResult = await cleanedResponse.json();

    if (cleanedResult.status === "OK" && cleanedResult.results.length > 0) {
      const location = cleanedResult.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      } as Coordinates;
    }
  }

  return null;
}

/**
 * Get place suggestions using Google Places Autocomplete API (New)
 */
export async function getPlaceSuggestions(
  query: string,
  userCoordinates?: Coordinates,
): Promise<Array<PlaceSuggestion>> {
  if (!query || query.length < 2) {
    return [];
  }

  const requestBody: Record<string, unknown> = {
    input: query,
    includedRegionCodes: ["us", "ca", "gb"],
  };

  // Add location bias if user coordinates are provided
  if (userCoordinates) {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: userCoordinates.lat,
          longitude: userCoordinates.lng,
        },
        radius: 50000, // 50km bias
      },
    };
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  const result = await response.json();

  if (result.suggestions) {
    return result.suggestions.map((s: Record<string, unknown>) => {
      const placePrediction = s.placePrediction as Record<string, unknown> | undefined;
      const structuredFormat = placePrediction?.structuredFormat as
        | Record<string, unknown>
        | undefined;
      return {
        label: (placePrediction?.text as Record<string, unknown> | undefined)?.text as string,
        placeId: placePrediction?.placeId as string,
        mainText: (structuredFormat?.mainText as Record<string, unknown> | undefined)
          ?.text as string,
        secondaryText: (structuredFormat?.secondaryText as Record<string, unknown> | undefined)
          ?.text as string,
      };
    }) as Array<PlaceSuggestion>;
  }

  return [];
}

/**
 * Optimize route using Google Routes API
 */
export async function optimizeRoute({
  origin,
  destination,
  waypoints,
  optimize,
}: {
  origin: Coordinates;
  destination: Coordinates;
  waypoints: Array<RouteWaypoint>;
  optimize?: boolean;
}): Promise<OptimizedRoute | null> {
  const requestBody = {
    origin: toLocation(origin),
    destination: toLocation(destination),
    intermediates: waypoints.map((wp) => toLocation(wp.coordinates)),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    // Nothing to reorder with fewer than 2 stops
    optimizeWaypointOrder: optimize !== false && waypoints.length > 1,
    computeAlternativeRoutes: false,
  };

  const response = await fetch(COMPUTE_ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline,routes.legs,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify(requestBody),
  });

  const result = await response.json();

  if (!result.routes || result.routes.length === 0) {
    return null;
  }

  const route = result.routes[0];
  const waypointOrder = resolveWaypointOrder(
    waypoints.length,
    route.optimizedIntermediateWaypointIndex,
  );

  // Reorder waypoints based on optimization
  const orderedWaypoints = waypointOrder.map((i) => waypoints[i]);

  // Extract metrics from legs
  const metrics = (route.legs as Array<RouteLeg>).map(toRouteMetrics);

  // Calculate totals
  const totalDistanceMeters = metrics.reduce(
    (sum: number, m: RouteMetrics) => sum + m.distanceValue,
    0,
  );
  const totalDurationSeconds = metrics.reduce(
    (sum: number, m: RouteMetrics) => sum + m.durationValue,
    0,
  );

  return {
    orderedWaypoints,
    waypointOrder,
    metrics,
    overviewPolyline: route.polyline?.encodedPolyline || "",
    totalDistance: formatDistance(totalDistanceMeters),
    totalDuration: formatDuration(`${totalDurationSeconds}s`),
  };
}

/**
 * Calculate route metrics for a given route order.
 * This is used after route optimization or manual reordering to get
 * distance and duration for each leg of the journey.
 *
 * Route: currentLocation -> waypoints (in order) -> destination (home or last waypoint)
 */
export async function calculateRouteMetrics({
  origin,
  waypoints,
  destination,
}: {
  origin: Coordinates;
  waypoints: Array<RouteWaypoint>;
  // Optional - user's home address. If not set, route ends at last waypoint
  destination?: Coordinates;
}): Promise<CalculatedRouteMetrics | null> {
  // If destination is provided (home address), all waypoints are intermediates
  // If no destination, the last waypoint becomes the destination
  let intermediateWaypoints: Array<RouteWaypoint>;
  let finalDestination: Coordinates;

  if (destination) {
    intermediateWaypoints = waypoints;
    finalDestination = destination;
  } else if (waypoints.length > 0) {
    intermediateWaypoints = waypoints.slice(0, -1);
    finalDestination = waypoints[waypoints.length - 1].coordinates;
  } else {
    // No waypoints at all
    return null;
  }

  const requestBody: Record<string, unknown> = {
    origin: toLocation(origin),
    destination: toLocation(finalDestination),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    optimizeWaypointOrder: false, // Never optimize - we're calculating for a specific order
    computeAlternativeRoutes: false,
  };

  // Only add intermediates if there are any
  if (intermediateWaypoints.length > 0) {
    requestBody.intermediates = intermediateWaypoints.map((wp) => toLocation(wp.coordinates));
  }

  const response = await fetch(COMPUTE_ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.legs",
    },
    body: JSON.stringify(requestBody),
  });

  const result = await response.json();

  if (!result.routes || result.routes.length === 0) {
    console.error("Routes API error:", result);
    return null;
  }

  // Legs: origin->waypoint1, waypoint1->waypoint2, ..., waypointN->destination
  // We want to return metrics for travel TO each waypoint (not including travel to home)
  const allLegs = (result.routes[0].legs as Array<RouteLeg>).map(toRouteMetrics);

  // Calculate metrics for each waypoint (travel TO that waypoint)
  const waypointMetrics = waypoints.map((_wp, index) => allLegs[index]);
  // The drive from the last stop home, when a home address was given
  const homeLeg = destination ? allLegs[waypoints.length] : undefined;

  // Calculate totals for all legs (including travel to home if applicable)
  const totalDistanceMeters = allLegs.reduce((sum, leg) => sum + leg.distanceValue, 0);
  const totalDurationSeconds = allLegs.reduce((sum, leg) => sum + leg.durationValue, 0);

  return {
    metrics: waypointMetrics,
    totalDistance: formatDistance(totalDistanceMeters),
    totalDuration: formatDuration(`${totalDurationSeconds}s`),
    totalDistanceValue: totalDistanceMeters,
    totalDurationValue: totalDurationSeconds,
    homeLeg,
  };
}
