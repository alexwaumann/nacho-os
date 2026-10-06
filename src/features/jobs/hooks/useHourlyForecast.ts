import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { Coordinates, HourlyForecastSlot } from "@/server/weather";
import { fetchHourlyForecast } from "@/server/weather";

const HOUR = 1000 * 60 * 60;

function getHourStart(now = Date.now()) {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  return date.getTime();
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
 */
export function useHourlyForecast(coordinates: Coordinates | undefined, upcomingHours = 4) {
  const hourStart = useCurrentHour();

  // ~1km precision so nearby stops share a forecast
  const lat = coordinates ? Number(coordinates.lat.toFixed(2)) : undefined;
  const lng = coordinates ? Number(coordinates.lng.toFixed(2)) : undefined;

  const query = useQuery({
    // The hour is part of the key, so a new forecast is fetched every time the hour turns
    queryKey: ["weather", "hourly", lat, lng, hourStart],
    queryFn: () => fetchHourlyForecast({ data: { coordinates: { lat: lat!, lng: lng! } } }),
    enabled: lat !== undefined && lng !== undefined,
    staleTime: HOUR / 2,
    gcTime: HOUR * 2,
    placeholderData: keepPreviousData,
  });

  let slots: Array<HourlyForecastSlot> | undefined;
  if (query.data) {
    const upcoming = query.data.hourly
      .filter((slot) => slot.time > hourStart)
      .slice(0, upcomingHours);
    slots = [query.data.current, ...upcoming];
  }

  return { slots, isLoading: query.isLoading };
}
