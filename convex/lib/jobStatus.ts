import type { Doc } from "../_generated/dataModel";

type JobStatus = Doc<"jobs">["status"];
type StatusDates = Pick<Doc<"jobs">, "completedOn" | "paidOn">;

/**
 * The finish and paid dates after a status change. Moving forward records the day each step was
 * first reached and keeps earlier dates. Moving back clears the dates of the steps that are
 * undone, so marking a job done by mistake (then Undo) doesn't leave a wrong date behind for when
 * it's really finished.
 */
export function getStatusDates(job: StatusDates, status: JobStatus, todayIso: string): StatusDates {
  if (status === "pending") return { completedOn: undefined, paidOn: undefined };
  if (status === "completed")
    return { completedOn: job.completedOn ?? todayIso, paidOn: undefined };
  return { completedOn: job.completedOn ?? todayIso, paidOn: job.paidOn ?? todayIso };
}
