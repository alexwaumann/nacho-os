import { useMutation } from "convex/react";
import type { SFSymbol } from "expo-symbols";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { toIsoDay } from "@shared/calendar";
import { applyStatusChange } from "@shared/jobs/jobSheet";
import type { JobStatus } from "@shared/jobs/jobSheet";
import { toast, toastError } from "@/components/ui/toast";
import { openDirectionsTo } from "@/lib/directions";
import { haptics } from "@/lib/haptics";

import { confirmDeleteJob } from "../lib/confirmDeleteJob";
import { patchJobInLists } from "../lib/optimisticJobs";
import { useToggleRoute } from "./useToggleRoute";

type Job = Doc<"jobs">;

export interface NextStatusAction {
  status: JobStatus;
  /** Short, for a swipe button */
  label: string;
  /** For a menu */
  title: string;
  icon: SFSymbol;
}

/**
 * The one step forward a job can take from the list: a pending job gets done, a done job gets
 * paid, a paid job has nowhere to go (null).
 */
export function getNextStatusAction(status: JobStatus): NextStatusAction | null {
  if (status === "pending") {
    return {
      status: "completed",
      label: "Done",
      title: "Mark done",
      icon: "checkmark.circle.fill",
    };
  }
  if (status === "completed") {
    return { status: "paid", label: "Paid", title: "Mark paid", icon: "dollarsign.circle.fill" };
  }
  return null;
}

const statusToast: Record<JobStatus, string> = {
  completed: "Marked done",
  paid: "Marked paid",
  pending: "Moved back to not done",
};

/**
 * What the Jobs list can do to a job from a swipe or its long-press menu: the route toggle (same
 * as the card's button), a status change with Undo, Directions, and a delete that asks first.
 * Each change shows on the card right away.
 */
export function useJobActions() {
  const toggleRoute = useToggleRoute();
  const updateStatus = useMutation(api.jobs.updateStatus).withOptimisticUpdate(
    (store, { jobId, status }) =>
      patchJobInLists(store, jobId, (job) => applyStatusChange(job, status, toIsoDay(new Date()))),
  );
  const removeJob = useMutation(api.jobs.remove);

  const setStatus = async (job: Job, status: JobStatus) => {
    const previous = job.status;
    if (status !== "pending") haptics.success();
    try {
      await updateStatus({ jobId: job._id, status });
      toast.success(statusToast[status], {
        description: job.address,
        id: `status-${job._id}`,
        action: {
          label: "Undo",
          onPress: () => {
            updateStatus({ jobId: job._id, status: previous }).catch((error: unknown) =>
              toastError("Couldn't undo that", error),
            );
          },
        },
      });
    } catch (error) {
      toastError("Couldn't change the status", error);
    }
  };

  const openDirections = (job: Job) => {
    openDirectionsTo(job.address).catch((error: unknown) =>
      toastError("Couldn't open Google Maps", error),
    );
  };

  const deleteJob = (job: Job) => {
    confirmDeleteJob(async () => {
      try {
        await removeJob({ jobId: job._id });
        toast.success("Job deleted", { description: job.address });
      } catch (error) {
        toastError("Couldn't delete the job", error);
      }
    });
  };

  return { toggleRoute, setStatus, openDirections, deleteJob };
}

export type JobActions = ReturnType<typeof useJobActions>;
