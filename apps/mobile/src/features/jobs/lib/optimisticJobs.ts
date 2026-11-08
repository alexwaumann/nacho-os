import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

type Job = Doc<"jobs">;

function findJob(store: OptimisticLocalStore, jobId: Id<"jobs">): Job | undefined {
  const single = store.getQuery(api.jobs.get, { jobId });
  if (single) return single;
  for (const { value } of store.getAllQueries(api.jobs.list)) {
    const job = value?.find((item) => item._id === jobId);
    if (job) return job;
  }
  return undefined;
}

/**
 * Change a job in the local Convex cache so the Jobs list shows it right away: it moves to the
 * list for its new status (newest first, like `jobs.list`), and the open job sheet and today's
 * route update too. Convex drops the patch once the server answers, or rolls it back on failure.
 */
export function patchJobInLists(
  store: OptimisticLocalStore,
  jobId: Id<"jobs">,
  patch: (job: Job) => Job,
) {
  const job = findJob(store, jobId);
  if (!job) return;
  const next = patch(job);

  for (const { args, value } of store.getAllQueries(api.jobs.list)) {
    if (!value) continue;
    const others = value.filter((item) => item._id !== jobId);
    const belongs = !args.status || args.status === next.status;
    store.setQuery(
      api.jobs.list,
      args,
      belongs ? [...others, next].sort((a, b) => b._creationTime - a._creationTime) : others,
    );
  }

  if (store.getQuery(api.jobs.get, { jobId })) store.setQuery(api.jobs.get, { jobId }, next);

  // Only stops already on the route; adding or dropping one is left to the server's order
  const route = store.getQuery(api.jobs.getSelectedForRoute, {});
  if (route?.some((stop) => stop._id === jobId) && next.selectedForRoute) {
    store.setQuery(
      api.jobs.getSelectedForRoute,
      {},
      route.map((stop) => (stop._id === jobId ? { ...stop, ...next } : stop)),
    );
  }
}
