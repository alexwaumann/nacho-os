// Helpers for the Today page: route stops, and plain-words labels for them

interface RouteStop {
  status: "pending" | "completed" | "paid";
}

/** A stop counts as done once it is completed or paid. */
export function isStopDone(job: RouteStop): boolean {
  return job.status !== "pending";
}

/** True when the route has stops and none of them are still pending. */
export function isRouteDone(jobs: ReadonlyArray<RouteStop>): boolean {
  return jobs.length > 0 && jobs.every(isStopDone);
}

/**
 * Puts a removed stop back into the route at the position it had (or at the end when the route
 * got shorter since). Returns the full order of ids.
 */
export function restoreStop<TId extends string>(
  currentOrder: ReadonlyArray<TId>,
  id: TId,
  index: number,
): Array<TId> {
  const order = currentOrder.filter((other) => other !== id);
  order.splice(Math.min(Math.max(index, 0), order.length), 0, id);
  return order;
}

/** The street part of an address ("123 Main St, Springfield, IL" -> "123 Main St"). */
export function getStreet(address: string): string {
  const street = address.split(",")[0]?.trim();
  return street || address.trim();
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
