import type { Doc, Id } from "../../../../convex/_generated/dataModel";

type Job = Doc<"jobs">;

export interface RankedReceiptJobs {
  /** Jobs on today's route, in route order */
  routeJobs: Array<Job>;
  /** Every other job that is not paid yet, newest first */
  otherJobs: Array<Job>;
}

function byRouteOrder(a: Job, b: Job): number {
  if (a.routeOrder === undefined && b.routeOrder === undefined) {
    return b._creationTime - a._creationTime;
  }
  if (a.routeOrder === undefined) return 1;
  if (b.routeOrder === undefined) return -1;
  return a.routeOrder - b.routeOrder;
}

/**
 * Order jobs for picking which job a receipt belongs to.
 * No address matching: receipts carry the store's address, not the job's.
 */
export function rankJobsForReceipt(jobs: Array<Job>): RankedReceiptJobs {
  const routeJobs = jobs.filter((job) => job.selectedForRoute).sort(byRouteOrder);
  const otherJobs = jobs
    .filter((job) => !job.selectedForRoute && job.status !== "paid")
    .sort((a, b) => b._creationTime - a._creationTime);

  return { routeJobs, otherJobs };
}

/**
 * Pre-select a job only when the answer is obvious: exactly one job on today's route.
 */
export function getDefaultReceiptJobId({ routeJobs }: RankedReceiptJobs): Id<"jobs"> | null {
  return routeJobs.length === 1 ? routeJobs[0]._id : null;
}
