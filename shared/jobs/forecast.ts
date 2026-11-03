// Picking which hourly forecast slots to show on a route card

import type { HourlyForecast, HourlyForecastSlot } from "../../convex/lib/weather";
import { findNearestSlotIndex } from "./arrival";

const HOUR = 60 * 60 * 1000;

/** Enough hours to reach the arrival time at the last stop of a long day */
export const FORECAST_HOURS = 16;

/** Start of the hour (ms) that `now` is in */
export function getHourStart(now = Date.now()): number {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

/** ms until just after the next hour starts (a small buffer so it never fires early) */
export function msUntilNextHour(now = Date.now(), bufferMs = 1000): number {
  return getHourStart(now) + HOUR - now + bufferMs;
}

/** ~1 km precision, so nearby stops share a forecast */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(2));
}

export interface ForecastSlots {
  /** Current conditions, then the upcoming hours */
  slots: Array<HourlyForecastSlot>;
  /** Index in `slots` nearest to the arrival time, or -1 */
  arrivalIndex: number;
}

/**
 * Current conditions followed by the next `upcomingHours` hourly slots after `hourStart`.
 *
 * With an `arrivalTime`, `arrivalIndex` points at the slot nearest to it (-1 if none). When that
 * hour is further out than the upcoming hours, it takes the place of the last one so it's shown.
 */
export function selectForecastSlots(
  forecast: HourlyForecast,
  hourStart: number,
  upcomingHours = 4,
  arrivalTime?: number,
): ForecastSlots {
  const upcoming = forecast.hourly.filter((slot) => slot.time > hourStart);
  const shown = upcoming.slice(0, upcomingHours);
  let arrivalIndex = -1;

  if (arrivalTime !== undefined && shown.length === upcomingHours) {
    const nearest = findNearestSlotIndex(
      upcoming.map((slot) => slot.time),
      arrivalTime,
    );
    if (nearest >= upcomingHours) {
      shown[upcomingHours - 1] = upcoming[nearest];
      arrivalIndex = upcomingHours;
    } else if (nearest >= 0) {
      arrivalIndex = nearest + 1;
    }
  }

  return { slots: [forecast.current, ...shown], arrivalIndex };
}
