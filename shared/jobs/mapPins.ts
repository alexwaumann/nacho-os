// Helpers for the jobs map: which pins to draw, how they look, and what to frame

export interface MapPoint {
  lat: number;
  lng: number;
}

interface PinJob {
  _id: string;
  status: "pending" | "completed" | "paid";
  coordinates?: MapPoint;
}

export interface JobPin<T extends PinJob> {
  job: T;
  position: MapPoint;
  /** 1-based stop number on today's route; undefined for the other (filtered) jobs */
  routeNumber?: number;
}

/**
 * The pins for the map: today's route stops, numbered in route order (always shown), and the jobs
 * matching the page filter. A route stop that also matches the filter shows once, as its numbered
 * pin. Jobs without coordinates have no pin.
 */
export function buildJobPins<T extends PinJob>(
  routeJobs: ReadonlyArray<T>,
  filteredJobs: ReadonlyArray<T>,
): { routePins: Array<JobPin<T>>; otherPins: Array<JobPin<T>> } {
  // Number stops the same way as the route list on the Today page (gaps count)
  const routePins = routeJobs.flatMap((job, index) =>
    job.coordinates ? [{ job, position: job.coordinates, routeNumber: index + 1 }] : [],
  );
  const routeJobIds = new Set(routeJobs.map((job) => job._id));
  const otherPins = filteredJobs.flatMap((job) =>
    !routeJobIds.has(job._id) && job.coordinates ? [{ job, position: job.coordinates }] : [],
  );
  return { routePins, otherPins };
}

/** What the map frames: today's route stops, or every pin on the map */
export type FitTarget = "route" | "all";

/**
 * What the fit button frames next. It switches between today's route and every pin, starting with
 * the route (like the web map); without a route it always frames every pin.
 */
export function getNextFitTarget(lastFit: FitTarget | null, hasRoute: boolean): FitTarget {
  if (!hasRoute) return "all";
  return lastFit === "route" ? "all" : "route";
}

/** The points to frame for a target. The route falls back to every pin when it has none. */
export function getFitPoints<T extends PinJob>(
  target: FitTarget,
  routePins: ReadonlyArray<JobPin<T>>,
  otherPins: ReadonlyArray<JobPin<T>>,
): Array<MapPoint> {
  const pins =
    target === "route" && routePins.length > 0 ? routePins : [...routePins, ...otherPins];
  return pins.map((pin) => pin.position);
}

/**
 * How a pin looks: route stops are numbered (brand color); other jobs by status: pending solid
 * slate, completed green with a check, paid faded grey with a $.
 */
export type PinKind = "route" | "pending" | "completed" | "paid";

export function getPinKind(pin: {
  job: { status: PinJob["status"] };
  routeNumber?: number;
}): PinKind {
  return pin.routeNumber !== undefined ? "route" : pin.job.status;
}

/** Route pins draw above other jobs, with lower stop numbers on top. */
export function getPinZIndex(pin: { routeNumber?: number }): number {
  return pin.routeNumber !== undefined ? 1000 - pin.routeNumber : 10;
}
