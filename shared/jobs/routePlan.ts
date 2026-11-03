// Pure helpers for saving today's route: which jobs are on it, in what order, and each leg's drive

import type { RouteMetrics } from "../../convex/lib/routing";

export interface RouteSelection<TId extends string> {
  jobId: TId;
  selected: boolean;
  routeOrder: number | undefined;
}

export interface RouteLegUpdate<TId extends string> {
  jobId: TId;
  routeOrder: number;
  travelTime: string | undefined;
  distance: string | undefined;
  travelTimeValue: number | undefined;
  distanceValue: number | undefined;
}

/**
 * The selection changes for `jobs.batchUpdateRouteSelection`: the route's jobs in order, then the
 * jobs that were on the route before and aren't anymore.
 */
export function buildRouteSelections<TId extends string>(
  orderedIds: ReadonlyArray<TId>,
  deselectedIds: ReadonlyArray<TId> = [],
): Array<RouteSelection<TId>> {
  return [
    ...orderedIds.map((jobId, index) => ({ jobId, selected: true, routeOrder: index })),
    ...deselectedIds.map((jobId) => ({ jobId, selected: false, routeOrder: undefined })),
  ];
}

/**
 * The per-stop drive metrics for `jobs.batchUpdateRouteMetrics`. `metrics[i]` is the leg that
 * drives TO stop i (any extra leg, like the drive home, is ignored).
 */
export function buildRouteLegUpdates<TId extends string>(
  orderedIds: ReadonlyArray<TId>,
  metrics: ReadonlyArray<RouteMetrics>,
): Array<RouteLegUpdate<TId>> {
  return orderedIds.map((jobId, index) => ({
    jobId,
    routeOrder: index,
    travelTime: metrics[index]?.duration,
    distance: metrics[index]?.distance,
    travelTimeValue: metrics[index]?.durationValue,
    distanceValue: metrics[index]?.distanceValue,
  }));
}

/** Total meters and seconds over all legs */
export function sumRouteLegs(metrics: ReadonlyArray<RouteMetrics>): {
  distanceValue: number;
  durationValue: number;
} {
  return metrics.reduce(
    (sum, leg) => ({
      distanceValue: sum.distanceValue + leg.distanceValue,
      durationValue: sum.durationValue + leg.durationValue,
    }),
    { distanceValue: 0, durationValue: 0 },
  );
}

/** Jobs that are on the route now but weren't picked this time */
export function getDeselectedIds<TId extends string>(
  jobs: ReadonlyArray<{ _id: TId; selectedForRoute?: boolean }>,
  selectedIds: ReadonlyArray<TId>,
): Array<TId> {
  const selected = new Set(selectedIds);
  return jobs.filter((job) => job.selectedForRoute && !selected.has(job._id)).map((job) => job._id);
}

/** The message when Google couldn't find some job addresses, in plain words */
export function describeGeocodeFailure(addresses: ReadonlyArray<string>): string {
  if (addresses.length === 1) {
    return `Couldn't find ${addresses[0]} on the map. Check the address on that job, then try again.`;
  }
  return `Couldn't find these addresses on the map: ${addresses.join("; ")}. Check the address on those jobs, then try again.`;
}

/** True when the two orders differ (length or any position) */
export function hasOrderChanged(
  order: ReadonlyArray<string>,
  previous: ReadonlyArray<string>,
): boolean {
  return order.length !== previous.length || order.some((id, index) => id !== previous[index]);
}

/** A copy of `order` with the item at `from` moved to `to` (both clamped to the list) */
export function moveInOrder<T>(order: ReadonlyArray<T>, from: number, to: number): Array<T> {
  const next = [...order];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(to, 0), next.length), 0, item);
  return next;
}
