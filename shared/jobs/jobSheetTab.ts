import type { Doc } from "../../convex/_generated/dataModel";

export const JOB_SHEET_TABS = ["tasks", "info", "money", "photos"] as const;

export type JobSheetTab = (typeof JOB_SHEET_TABS)[number];

/**
 * The tab a job opens on when no tab was picked: the checklist for a job he's
 * working today, the money for a finished job that isn't paid yet, else the info.
 */
export function getDefaultJobSheetTab(
  job: Pick<Doc<"jobs">, "status" | "selectedForRoute">,
): JobSheetTab {
  if (job.status === "pending" && job.selectedForRoute) return "tasks";
  if (job.status === "completed") return "money";
  return "info";
}
