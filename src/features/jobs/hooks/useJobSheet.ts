import { useEffect, useState } from "react";
import { z } from "zod";

import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import { getDefaultJobSheetTab, jobSheetTabSchema } from "../lib/jobSheetTab";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { JobSheetTab } from "../lib/jobSheetTab";

export type { JobSheetTab } from "../lib/jobSheetTab";

// Search params for the job detail sheet; spread into a route's search schema
export const jobSheetSearchSchema = {
  job: z.string().optional(),
  tab: jobSheetTabSchema,
};

/**
 * Keeps the job detail sheet's open job and tab in the URL (?job=<id>&tab=tasks)
 * so a refresh or shared link lands on the same job and tab. A job opened without
 * a tab gets one picked from its status once it loads (see getDefaultJobSheetTab).
 */
export function useJobSheet() {
  const navigate = useNavigate();
  const search: { job?: string; tab?: JobSheetTab } = useSearch({ strict: false });
  const jobId = search.job as Id<"jobs"> | undefined;
  const isOpen = !!jobId;

  // Keep rendering the last job while the drawer animates closed
  const [lastJobId, setLastJobId] = useState(jobId ?? null);
  if (jobId && jobId !== lastJobId) {
    setLastJobId(jobId);
  }

  // Same query as the sheet, so it shares the cache and adds no request
  const { data: job } = useQuery({
    ...convexQuery(api.jobs.get, { jobId: lastJobId! }),
    enabled: !!lastJobId,
  });
  const openedJob = isOpen && job?._id === jobId ? job : undefined;

  const resolvedTab = search.tab ?? (openedJob ? getDefaultJobSheetTab(openedJob) : undefined);
  // Keep the last tab too, so the drawer doesn't flip tabs while it animates closed
  const [lastTab, setLastTab] = useState<JobSheetTab>(resolvedTab ?? "info");
  if (resolvedTab && resolvedTab !== lastTab) {
    setLastTab(resolvedTab);
  }

  // Pin the default into the URL once the job loads, so finishing the job later
  // doesn't move him off the tab he's on. Never overrides a tab he already picked.
  useEffect(() => {
    if (search.tab || !openedJob) return;
    const tab = getDefaultJobSheetTab(openedJob);
    void navigate({
      to: ".",
      search: (prev: { job?: string; tab?: JobSheetTab }) =>
        prev.job === openedJob._id && !prev.tab ? { ...prev, tab } : prev,
      replace: true,
    });
  }, [search.tab, openedJob, navigate]);

  const handleOpenJob = (id: Id<"jobs">) => {
    void navigate({ to: ".", search: (prev) => ({ ...prev, job: id, tab: undefined }) });
  };

  // Replace rather than push so the back button doesn't step through tab switches
  const setTab = (tab: JobSheetTab) => {
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, tab }),
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
    isOpen,
    tab: lastTab,
    openJob: handleOpenJob,
    setTab,
    handleOpenChange,
  };
}
