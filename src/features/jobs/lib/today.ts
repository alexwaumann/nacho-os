// Helpers for the Today page: which route stop is next, and plain-words labels for it

interface RouteStop {
  _id: string;
  status: "pending" | "completed" | "paid";
}

export interface SplitRoute<T> {
  /** The first stop that is still pending, or null */
  next: T | null;
  /** Every other stop, in route order (done stops included) */
  rest: Array<T>;
  /** True when the route has stops and none of them are pending */
  allDone: boolean;
}

/** A stop counts as done once it is completed or paid. */
export function isStopDone(job: RouteStop): boolean {
  return job.status !== "pending";
}

/** The first route stop (in route order) that is still pending, or null. */
export function pickNextStop<T extends RouteStop>(jobs: ReadonlyArray<T>): T | null {
  return jobs.find((job) => !isStopDone(job)) ?? null;
}

/** Splits today's route into the next stop (shown big) and the rest of the list. */
export function splitRoute<T extends RouteStop>(jobs: ReadonlyArray<T>): SplitRoute<T> {
  const next = pickNextStop(jobs);
  return {
    next,
    rest: jobs.filter((job) => job !== next),
    allDone: jobs.length > 0 && next === null,
  };
}

/**
 * Puts a reordered "rest of the route" back into the full route order, keeping the next stop
 * (`pinnedId`) where it was. Returns the full order of ids.
 */
export function mergeRestOrder<TId extends string>(
  fullOrder: ReadonlyArray<TId>,
  pinnedId: TId | null,
  restOrder: ReadonlyArray<TId>,
): Array<TId> {
  if (!pinnedId || !fullOrder.includes(pinnedId)) return [...restOrder];
  const merged = [...restOrder];
  merged.splice(fullOrder.indexOf(pinnedId), 0, pinnedId);
  return merged;
}

/** "45 min drive", "1 hr drive", "1 hr 20 min drive"; null when the drive time is unknown. */
export function formatDriveTime(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min drive`;
  if (minutes === 0) return `${hours} hr drive`;
  return `${hours} hr ${minutes} min drive`;
}

/** "4 of 6 tasks left", "All tasks done"; null when the job has no tasks. */
export function formatTasksLeft(
  tasks: ReadonlyArray<{ completed: boolean }> | undefined,
): string | null {
  if (!tasks || tasks.length === 0) return null;
  const left = tasks.filter((task) => !task.completed).length;
  if (left === 0) return "All tasks done";
  return `${left} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} left`;
}
