import { useMutation } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { toast, toastError } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";

import { patchJobInLists } from "../lib/optimisticJobs";

/**
 * Adds a job to today's route or takes it off, with an Undo toast. Same mutation as the route
 * button on the web job card. The card changes right away; a success haptic marks an add.
 */
export function useToggleRoute() {
  const toggleSelectedForRoute = useMutation(api.jobs.toggleSelectedForRoute).withOptimisticUpdate(
    (store, { jobId, selected }) =>
      patchJobInLists(store, jobId, (job) => ({ ...job, selectedForRoute: selected })),
  );

  const setSelected = async (job: Doc<"jobs">, selected: boolean) => {
    await toggleSelectedForRoute({ jobId: job._id, selected });
  };

  return async (job: Doc<"jobs">) => {
    const selected = !job.selectedForRoute;
    if (selected) haptics.success();
    else haptics.light();
    try {
      await setSelected(job, selected);
      toast.success(selected ? "Added to today's route" : "Taken off today's route", {
        description: job.address,
        id: `route-${job._id}`,
        action: {
          label: "Undo",
          onPress: () => {
            setSelected(job, !selected).catch((error: unknown) =>
              toastError("Couldn't undo that", error),
            );
          },
        },
      });
    } catch (error) {
      toastError("Couldn't change today's route", error);
    }
  };
}
