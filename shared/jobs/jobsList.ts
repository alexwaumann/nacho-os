// Helpers for the Jobs list: which jobs show for a filter and search, and each job card's labels

import { sortJobsByDueDate } from "./dueDate";

export type JobFilter = "pending" | "completed" | "paid";

interface TaskLike {
  completed: boolean;
  requiresOnlineOrder?: boolean;
}

interface ListJob {
  address: string;
  dueDate?: string;
}

interface StatusJob {
  status: JobFilter;
  tasks?: ReadonlyArray<TaskLike>;
}

/** True when the address contains the search text, ignoring case and extra spaces. */
export function matchesAddressSearch(address: string, searchQuery: string): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  return address.toLowerCase().includes(query);
}

/**
 * The jobs to list for a filter: only the ones matching the address search, with pending work
 * sorted by what's due first. Completed and paid jobs keep their order (newest first from the
 * server). Returns a new array.
 */
export function getVisibleJobs<T extends ListJob>(
  jobs: ReadonlyArray<T>,
  filter: JobFilter,
  searchQuery: string,
): Array<T> {
  const matching = jobs.filter((job) => matchesAddressSearch(job.address, searchQuery));
  return filter === "pending" ? sortJobsByDueDate(matching) : matching;
}

/** How many tasks are done out of how many. */
export function getTaskProgress(job: { tasks?: ReadonlyArray<TaskLike> }): {
  done: number;
  total: number;
} {
  const tasks = job.tasks ?? [];
  return { done: tasks.filter((task) => task.completed).length, total: tasks.length };
}

export type JobProgressStatus = "paid" | "completed" | "parts-needed" | "in-progress" | "pending";

/**
 * The status label a job card shows. Paid and completed win; open work shows "parts needed" while
 * a task still waits on an online order, then "in progress" once some (not all) tasks are done.
 */
export function getJobProgressStatus(job: StatusJob): JobProgressStatus {
  if (job.status === "paid") return "paid";
  if (job.status === "completed") return "completed";
  if (job.tasks?.some((task) => task.requiresOnlineOrder && !task.completed)) {
    return "parts-needed";
  }
  const { done, total } = getTaskProgress(job);
  if (done > 0 && done < total) return "in-progress";
  return "pending";
}

export const jobProgressStatusLabel: Record<JobProgressStatus, string> = {
  paid: "Paid",
  completed: "Completed",
  "parts-needed": "Parts needed",
  "in-progress": "In progress",
  pending: "Pending",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A job added in the last 24 hours gets a "New" badge. */
export function isNewJob(creationTime: number, now: number): boolean {
  return now - creationTime < DAY_MS;
}

/**
 * A YYYY-MM-DD due date as "Nov 3, 2026" in local time. Older free-text dates come back as typed.
 */
export function formatDueDate(value: string, locale?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}
