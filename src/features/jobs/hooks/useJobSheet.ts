import { useState } from "react";
import { z } from "zod";

import { useNavigate, useSearch } from "@tanstack/react-router";

import type { Id } from "../../../../convex/_generated/dataModel";

export type JobSheetTab = "details" | "tasks";

// Search params for the job detail sheet; spread into a route's search schema
export const jobSheetSearchSchema = {
  job: z.string().optional(),
  tab: z.enum(["details", "tasks"]).optional().catch(undefined),
};

/**
 * Keeps the job detail sheet's open job and tab in the URL (?job=<id>&tab=tasks)
 * so a refresh or shared link lands on the same job and tab.
 */
export function useJobSheet() {
  const navigate = useNavigate();
  const search: { job?: string; tab?: JobSheetTab } = useSearch({ strict: false });
  const jobId = search.job as Id<"jobs"> | undefined;

  // Keep rendering the last job while the drawer animates closed
  const [lastJobId, setLastJobId] = useState(jobId ?? null);
  if (jobId && jobId !== lastJobId) {
    setLastJobId(jobId);
  }

  const openJob = (id: Id<"jobs">) => {
    void navigate({ to: ".", search: (prev) => ({ ...prev, job: id, tab: undefined }) });
  };

  // Replace rather than push so the back button doesn't step through tab switches
  const setTab = (tab: JobSheetTab) => {
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, tab: tab === "details" ? undefined : tab }),
      replace: true,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, job: undefined, tab: undefined }),
      replace: true,
    });
  };

  return {
    jobId: lastJobId,
    isOpen: !!jobId,
    tab: search.tab ?? "details",
    openJob,
    setTab,
    handleOpenChange,
  };
}
