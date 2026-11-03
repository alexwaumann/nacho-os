import { useCallback, useEffect, useRef, useState } from "react";

import type { Doc, Id } from "@convex/_generated/dataModel";
import { buildOrderKey } from "@shared/jobs/routeBrief";

type JobId = Id<"jobs">;

/**
 * The route order on screen. It follows the server, but can be changed right away (a drag, a
 * removal, an Undo) before the server catches up. The jobs themselves always come from `stops`.
 */
export function useRouteOrder(stops: Doc<"jobs">[] | undefined) {
  const [order, setOrderState] = useState<JobId[]>(() => stops?.map((job) => job._id) ?? []);
  // For route changes that finish later (like Undo), which need the order at that moment
  const orderRef = useRef(order);
  const serverKeyRef = useRef<string | null>(null);

  const setOrder = useCallback((next: JobId[]) => {
    orderRef.current = next;
    setOrderState(next);
  }, []);

  // Take the server's order whenever its ids or their order change
  useEffect(() => {
    if (!stops) return;
    const ids = stops.map((job) => job._id);
    const key = buildOrderKey(ids);
    if (key !== serverKeyRef.current) {
      serverKeyRef.current = key;
      setOrder(ids);
    }
  }, [stops, setOrder]);

  const getOrder = useCallback(() => orderRef.current, []);

  const jobsById = new Map((stops ?? []).map((job) => [job._id, job]));
  const orderedJobs = order.flatMap((id) => {
    const job = jobsById.get(id);
    return job ? [job] : [];
  });

  return { orderedJobs, order, setOrder, getOrder };
}
