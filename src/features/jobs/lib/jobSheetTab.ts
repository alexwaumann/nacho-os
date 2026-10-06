import * as z from "zod";

import type { Doc } from "../../../../convex/_generated/dataModel";

export const JOB_SHEET_TABS = ["tasks", "info", "money"] as const;

export type JobSheetTab = (typeof JOB_SHEET_TABS)[number];

/**
 * The ?tab= search param. "details" was the old combined tab, so links saved
 * before the split land on Info; anything unknown falls back to the default tab.
 */
export const jobSheetTabSchema = z
  .enum([...JOB_SHEET_TABS, "details"])
  .transform((tab): JobSheetTab => (tab === "details" ? "info" : tab))
  .optional()
  .catch(undefined);

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
