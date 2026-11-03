import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  FORECAST_HOURS,
  getHourStart,
  roundCoordinate,
  selectForecastSlots,
} from "@shared/jobs/forecast";

import { api } from "../../../../convex/_generated/api";
import type { Coordinates } from "../../../../convex/lib/weather";
import { convexQueryClient } from "@/integrations/tanstack-query/root-provider";

const HOUR = 1000 * 60 * 60;

/**
 * The hourly forecast query for a site, shared by the forecast strip and the voice assistant.
 * The hour is part of the key, so a new forecast is fetched every time the hour turns.
 */
export function hourlyForecastQueryOptions(coordinates: Coordinates, hourStart: number) {
  const lat = roundCoordinate(coordinates.lat);
  const lng = roundCoordinate(coordinates.lng);
  return queryOptions({
    queryKey: ["weather", "hourly", lat, lng, hourStart, FORECAST_HOURS],
    queryFn: () =>
      convexQueryClient.convexClient.action(api.weather.getHourlyForecast, {
        coordinates: { lat, lng },
        hours: FORECAST_HOURS,
      }),
    staleTime: HOUR / 2,
    gcTime: HOUR * 2,
  });
}

/**
 * Start of the current hour (ms), updated when the clock rolls over to the next hour.
 * Also re-checks when the app comes back to the foreground, since phones pause timers.
 */
export function useCurrentHour() {
  const [hourStart, setHourStart] = useState(getHourStart);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      const nextHourStart = getHourStart();
      setHourStart(nextHourStart);
      clearTimeout(timeout);
      // Small buffer so the timer never fires a moment before the hour turns
      timeout = setTimeout(sync, nextHourStart + HOUR - Date.now() + 1000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") sync();
    };

    sync();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return hourStart;
}

/**
 * Current conditions followed by the next `upcomingHours` hourly slots.
 *
 * With an `arrivalTime`, `arrivalIndex` points at the slot nearest to it (-1 if none). When that
 * hour is further out than the upcoming hours, it takes the place of the last one so it's shown.
 */
export function useHourlyForecast(
  coordinates: Coordinates | undefined,
  upcomingHours = 4,
  arrivalTime?: number,
) {
  const hourStart = useCurrentHour();

  const query = useQuery({
    ...hourlyForecastQueryOptions(coordinates ?? { lat: 0, lng: 0 }, hourStart),
    enabled: !!coordinates,
    placeholderData: keepPreviousData,
  });

  const { slots, arrivalIndex } =
    query.data ?
      selectForecastSlots(query.data, hourStart, upcomingHours, arrivalTime)
    : { slots: undefined, arrivalIndex: -1 };

  return { slots, arrivalIndex, isLoading: query.isLoading };
}
