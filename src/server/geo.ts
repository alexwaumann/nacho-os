import { createServerFn } from "@tanstack/react-start";

import { env } from "@/env";

// Type definitions
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

function getApiKey() {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured in environment variables");
  }
  return apiKey;
}

/**
 * Geocode an address to coordinates using Google Geocoding API
 */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((data: { address: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = getApiKey();
    const encodedAddress = encodeURIComponent(data.address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

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
    const cleanedAddress = data.address
      .replace(/[,]?\s*(?:unit|suite|apt|apartment|room|bldg|building|floor)\s*[\w\d-]+/gi, "")
      .replace(/[,]?\s*#[\w\d-]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanedAddress !== data.address && cleanedAddress.length > 5) {
      const cleanedUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanedAddress)}&key=${apiKey}`;
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
  });

/**
 * Get place suggestions using Google Places Autocomplete API (New)
 */
export const getPlaceSuggestions = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string; userCoordinates?: Coordinates }) => data)
  .handler(async ({ data }) => {
    if (!data.query || data.query.length < 2) {
      return [] as Array<PlaceSuggestion>;
    }

    const apiKey = getApiKey();
    const url = "https://places.googleapis.com/v1/places:autocomplete";

    const requestBody: Record<string, unknown> = {
      input: data.query,
      includedRegionCodes: ["us", "ca", "gb"],
    };

    // Add location bias if user coordinates are provided
    if (data.userCoordinates) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: data.userCoordinates.lat,
            longitude: data.userCoordinates.lng,
          },
          radius: 50000, // 50km bias
        },
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
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

    return [] as Array<PlaceSuggestion>;
  });

/**
 * Optimize route using Google Routes API
 */
export const optimizeRoute = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      origin: Coordinates;
      destination: Coordinates;
      waypoints: Array<RouteWaypoint>;
      optimize?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const apiKey = getApiKey();
    const url = "https://routes.googleapis.com/directions/v2:computeRoutes";

    const intermediates = data.waypoints.map((wp) => ({
      location: {
        latLng: {
          latitude: wp.coordinates.lat,
          longitude: wp.coordinates.lng,
        },
      },
    }));

    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: data.origin.lat,
            longitude: data.origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: data.destination.lat,
            longitude: data.destination.lng,
          },
        },
      },
      intermediates,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      optimizeWaypointOrder: data.optimize !== false,
      computeAlternativeRoutes: false,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
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
    const waypointOrder =
      route.optimizedIntermediateWaypointIndex || data.waypoints.map((_, i) => i);

    // Reorder waypoints based on optimization
    const orderedWaypoints = waypointOrder.map((i: number) => data.waypoints[i]);

    // Extract metrics from legs
    const metrics = route.legs.map((leg: Record<string, unknown>) => ({
      distance: formatDistance(leg.distanceMeters as number),
      duration: formatDuration(leg.duration as string),
      distanceValue: leg.distanceMeters as number,
      durationValue: parseDuration(leg.duration as string),
    }));

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
    } as OptimizedRoute;
  });

/**
 * Fetch route matrix for distance calculations
 */
export const fetchRouteMatrix = createServerFn({ method: "POST" })
  .inputValidator((data: { origins: Array<Coordinates>; destinations: Array<Coordinates> }) => data)
  .handler(async ({ data }) => {
    const apiKey = getApiKey();
    const url = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

    const requestBody = {
      origins: data.origins.map((o) => ({
        waypoint: { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
      })),
      destinations: data.destinations.map((d) => ({
        waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,status",
      },
      body: JSON.stringify(requestBody),
    });

    return await response.json();
  });

// Helper functions
function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 1 ? `${Math.round(miles * 10) / 10} mi` : `${Math.round(miles * 10) / 10} mi`;
}

function formatDuration(duration: string): string {
  // Duration comes as "123s" format
  const seconds = parseInt(duration.replace("s", ""), 10);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

function parseDuration(duration: string): number {
  return parseInt(duration.replace("s", ""), 10);
}

/**
 * Calculate distance between two coordinates (Haversine formula)
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

/**
 * Check if a location is nearby (default threshold: 200m)
 */
export function isLocationNearby(
  userCoords: Coordinates,
  jobCoords: Coordinates,
  thresholdKm: number = 0.2,
): boolean {
  return calculateDistance(userCoords, jobCoords) <= thresholdKm;
}

/**
 * Generate a Google Maps navigation URL
 */
export function generateGoogleMapsUrl(
  waypoints: Array<{ coordinates?: Coordinates }>,
  useCurrentLocation: boolean = true,
): string | null {
  const validPoints = waypoints.filter(
    (p): p is { coordinates: Coordinates } => p.coordinates !== undefined,
  );
  if (validPoints.length < 2) return null;

  let origin = "";
  let destination = "";
  let waypointsList: Array<{ coordinates: Coordinates }> = [];

  if (useCurrentLocation) {
    // Leave origin blank for "My Location"
    origin = "";
    waypointsList = validPoints.slice(1, -1);
    const end = validPoints[validPoints.length - 1];
    destination = `${end.coordinates.lat},${end.coordinates.lng}`;
  } else {
    const start = validPoints[0];
    const end = validPoints[validPoints.length - 1];
    origin = `${start.coordinates.lat},${start.coordinates.lng}`;
    destination = `${end.coordinates.lat},${end.coordinates.lng}`;
    waypointsList = validPoints.slice(1, -1);
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
