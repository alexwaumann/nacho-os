import type { ConvexReactClient } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Coordinates, HourlyForecast } from "@convex/lib/weather";
import { FORECAST_HOURS, roundCoordinate } from "@shared/jobs/forecast";

// One request per site and hour, shared by every card (and later the voice assistant). The web
// app gets the same from TanStack Query; here a small in-memory cache is enough.
const cache = new Map<string, Promise<HourlyForecast>>();
// Old hours are dropped once this many sites/hours are cached
const MAX_ENTRIES = 40;

function cacheKey(coordinates: Coordinates, hourStart: number) {
  return `${roundCoordinate(coordinates.lat)},${roundCoordinate(coordinates.lng)}@${hourStart}`;
}

/** A forecast already fetched for this site and hour, without asking for it */
export function getCachedForecastPromise(coordinates: Coordinates, hourStart: number) {
  return cache.get(cacheKey(coordinates, hourStart));
}

/**
 * Current conditions and the next hours at a site (`weather.getHourlyForecast`), fetched once per
 * site (~1 km) and hour. A failed fetch isn't cached, so the next caller tries again.
 */
export function fetchHourlyForecast(
  convex: ConvexReactClient,
  coordinates: Coordinates,
  hourStart: number,
): Promise<HourlyForecast> {
  const key = cacheKey(coordinates, hourStart);
  const cached = cache.get(key);
  if (cached) return cached;

  const request = convex
    .action(api.weather.getHourlyForecast, {
      coordinates: { lat: roundCoordinate(coordinates.lat), lng: roundCoordinate(coordinates.lng) },
      hours: FORECAST_HOURS,
    })
    .catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, request);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return request;
}
