import { useMutation } from "convex/react";
import { useRef } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { getStreet, restoreStop } from "../lib/today";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import { toastClassNames } from "@/features/voice/lib/voiceClient";

type JobId = Id<"jobs">;

// Long enough to read the toast and reach for Undo
const REMOVED_TOAST_MS = 8_000;

interface UseRemoveRouteStopOptions {
  /** The route order on screen right now */
  getOrder: () => Array<JobId>;
  /** Shows a new route order right away, before the server catches up */
  setOrder: (order: Array<JobId>) => void;
  recalculateRouteMetrics: (
    orderedJobIds: Array<JobId>,
    options?: { quiet?: boolean },
  ) => Promise<void>;
}

/**
 * Takes a stop off today's route (the job itself stays), recalculates the drive times for the
 * rest, and offers an Undo that puts it back at the same place.
 */
export function useRemoveRouteStop({
  getOrder,
  setOrder,
  recalculateRouteMetrics,
}: UseRemoveRouteStopOptions) {
  const toggleSelectedForRoute = useMutation(api.jobs.toggleSelectedForRoute);
  const batchUpdateRouteSelection = useMutation(api.jobs.batchUpdateRouteSelection);
  // Route changes run one after another, so an Undo never races the removal's recalculation
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueue = (task: () => Promise<void>) => {
    const next = queueRef.current.then(task, task);
    queueRef.current = next.catch(() => {});
    return next;
  };

  const handleUndo = (jobId: JobId, index: number, street: string) => {
    // Show it back in place right away; the save waits for the removal to finish
    setOrder(restoreStop(getOrder(), jobId, index));
    return enqueue(async () => {
      const order = restoreStop(getOrder(), jobId, index);
      setOrder(order);
      try {
        await batchUpdateRouteSelection({
          selections: order.map((id, routeOrder) => ({ jobId: id, selected: true, routeOrder })),
        });
        toast.success(`${street} is back on today's route`, { classNames: toastClassNames });
      } catch (error) {
        console.error("Undo remove from route failed:", error);
        setOrder(getOrder().filter((id) => id !== jobId));
        toast.error("Couldn't put the stop back", {
          description: error instanceof Error ? error.message : "Unknown error",
          classNames: toastClassNames,
        });
        return;
      }
      if (order.length >= 1) {
        await recalculateRouteMetrics(order, { quiet: true });
      }
    });
  };

  const removeStop = (job: Doc<"jobs">) => {
    const order = getOrder();
    const index = order.indexOf(job._id);
    const remaining = order.filter((id) => id !== job._id);
    const street = getStreet(job.address);

    setOrder(remaining);
    const toastId = toast.success(`Removed ${street} from today's route`, {
      duration: REMOVED_TOAST_MS,
      classNames: toastClassNames,
      action: { label: "Undo", onClick: () => void handleUndo(job._id, index, street) },
    });

    return enqueue(async () => {
      try {
        await toggleSelectedForRoute({ jobId: job._id, selected: false });
      } catch (error) {
        console.error("Remove from route failed:", error);
        toast.dismiss(toastId);
        setOrder(restoreStop(getOrder(), job._id, index));
        toast.error("Couldn't remove the stop", {
          description: error instanceof Error ? error.message : "Unknown error",
          classNames: toastClassNames,
        });
        return;
      }
      if (remaining.length >= 1) {
        await recalculateRouteMetrics(remaining, { quiet: true });
      }
    });
  };

  return { removeStop };
}
