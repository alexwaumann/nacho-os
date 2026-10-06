// Rough arrival times for the stops on today's route, in the device's local time

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Time assumed at each stop when we don't know better */
export const ON_SITE_MINUTES = 90;

/** The work day doesn't start before this hour, even if the app is opened earlier */
export const DAY_START_HOUR = 7;

/**
 * When the day's driving starts: the next full hour (8:20 → 9:00), but not before 7:00 AM.
 * Rounding to the hour means the result is the same all hour long, so the Today page and
 * the weather brief agree without re-rendering every minute.
 */
export function getRouteStartTime(now: number): number {
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  const dayStart = new Date(now);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);

  return Math.max(nextHour.getTime(), dayStart.getTime());
}

/**
 * Arrival time (ms) at each stop, given when the driving starts and each leg's travel time in
 * seconds (from the previous stop; missing legs count as no driving).
 */
export function estimateArrivalTimes(
  start: number,
  legSeconds: Array<number | undefined>,
  onSiteMinutes = ON_SITE_MINUTES,
): Array<number> {
  const arrivals: Array<number> = [];
  let clock = start;

  legSeconds.forEach((leg, index) => {
    if (index > 0) clock += onSiteMinutes * MINUTE;
    clock += Math.max(0, leg ?? 0) * 1000;
    arrivals.push(clock);
  });

  return arrivals;
}

/** Arrival times for a route that starts now (see getRouteStartTime) */
export function estimateRouteArrivals(
  now: number,
  legSeconds: Array<number | undefined>,
  onSiteMinutes = ON_SITE_MINUTES,
): Array<number> {
  return estimateArrivalTimes(getRouteStartTime(now), legSeconds, onSiteMinutes);
}

/**
 * Index of the slot whose time is closest to `target`, or -1 when none is within `maxDistance`
 * (so an arrival beyond the end of the forecast isn't pinned to its last hour).
 */
export function findNearestSlotIndex(
  slotTimes: Array<number>,
  target: number,
  maxDistance = HOUR / 2,
): number {
  let bestIndex = -1;
  let bestDistance = Infinity;

  slotTimes.forEach((time, index) => {
    const distance = Math.abs(time - target);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });

  return bestDistance <= maxDistance ? bestIndex : -1;
}
