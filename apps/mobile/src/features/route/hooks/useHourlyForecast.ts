import { useConvex } from "convex/react";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { Coordinates, HourlyForecast } from "@convex/lib/weather";
import { selectForecastSlots } from "@shared/jobs/forecast";

import {
  fetchHourlyForecast,
  getForecastRefreshCount,
  subscribeToForecastRefresh,
} from "../lib/forecastCache";
import { useCurrentHour } from "./useCurrentHour";

/**
 * Current conditions followed by the next `upcomingHours` hourly slots at a site, with
 * `arrivalIndex` pointing at the slot nearest `arrivalTime` (-1 if none). Fetches again when the
 * hour turns or after a pull to refresh (`refreshForecasts`), keeping the old forecast on screen
 * meanwhile.
 */
export function useHourlyForecast(
  coordinates: Coordinates | undefined,
  upcomingHours = 4,
  arrivalTime?: number,
) {
  const convex = useConvex();
  const hourStart = useCurrentHour();
  const [forecast, setForecast] = useState<HourlyForecast | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const refreshCount = useSyncExternalStore(subscribeToForecastRefresh, getForecastRefreshCount);

  const lat = coordinates?.lat;
  const lng = coordinates?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let isCurrent = true;
    fetchHourlyForecast(convex, { lat, lng }, hourStart)
      .then((data) => {
        if (!isCurrent) return;
        setForecast(data);
        setHasFailed(false);
      })
      .catch((error: unknown) => {
        console.log("Hourly forecast failed:", error);
        if (isCurrent) setHasFailed(true);
      });
    return () => {
      isCurrent = false;
    };
  }, [convex, lat, lng, hourStart, refreshCount]);

  const { slots, arrivalIndex } =
    forecast ?
      selectForecastSlots(forecast, hourStart, upcomingHours, arrivalTime)
    : { slots: undefined, arrivalIndex: -1 };

  return { slots, arrivalIndex, isLoading: !!coordinates && !forecast && !hasFailed };
}
