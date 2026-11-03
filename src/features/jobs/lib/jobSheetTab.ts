import * as z from "zod";

import { JOB_SHEET_TABS } from "@shared/jobs/jobSheetTab";
import type { JobSheetTab } from "@shared/jobs/jobSheetTab";

/**
 * The ?tab= search param. "details" was the old combined tab, so links saved
 * before the split land on Info; anything unknown falls back to the default tab.
 */
export const jobSheetTabSchema = z
  .enum([...JOB_SHEET_TABS, "details"])
  .transform((tab): JobSheetTab => (tab === "details" ? "info" : tab))
  .optional()
  .catch(undefined);
