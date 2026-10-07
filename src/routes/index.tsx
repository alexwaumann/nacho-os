import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Reorder } from "framer-motion";
import { AlertCircle, Loader2, Navigation, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";
import { JobDetailSheet } from "@/components/JobDetailSheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AllStopsDoneCard } from "@/features/jobs/components/AllStopsDoneCard";
import { EditRouteModal } from "@/features/jobs/components/EditRouteModal";
import { EmptyRouteCard } from "@/features/jobs/components/EmptyRouteCard";
import { RouteBriefCard } from "@/features/jobs/components/RouteBriefCard";
import { RouteSummaryCard } from "@/features/jobs/components/RouteSummaryCard";
import { SwipeableRouteCard } from "@/features/jobs/components/SwipeableRouteCard";
import { jobSheetSearchSchema, useJobSheet } from "@/features/jobs/hooks/useJobSheet";
import { useRemoveRouteStop } from "@/features/jobs/hooks/useRemoveRouteStop";
import { useRouteBrief } from "@/features/jobs/hooks/useRouteBrief";
import { useRouteOptimization } from "@/features/jobs/hooks/useRouteOptimization";
import { isRouteDone, isStopDone } from "@/features/jobs/lib/today";
import { ScanActions } from "@/features/scan/components/ScanActions";
import { cn } from "@/lib/utils";
import { openExternal } from "@/lib/openExternal";
import { generateGoogleMapsUrl } from "@/server/geo";

const searchSchema = z.object({
  "new-job": z.string().optional(),
  ...jobSheetSearchSchema,
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: TodayPage,
});

type JobId = Id<"jobs">;

function TodayPage() {
  // Sync user on first load
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);
  const removeQueueItem = useMutation(api.jobs.removeQueueItem);

  useEffect(() => {
    getOrCreateUser().catch(console.error);
  }, [getOrCreateUser]);

  const { data: selectedJobs = [], isSuccess: isRouteLoaded } = useQuery(
    convexQuery(api.jobs.getSelectedForRoute, {}),
  );
  const { data: routeTotals } = useQuery(convexQuery(api.jobs.getRouteTotals, {}));
  const { data: processingQueue = [] } = useQuery(convexQuery(api.jobs.listQueue, {}));
  const { data: currentUser } = useQuery(convexQuery(api.users.getCurrentUser, {}));

  const [editRouteOpen, setEditRouteOpen] = useState(false);

  const jobSheet = useJobSheet();

  const { isOptimizing, optimizeAndSaveRoute, recalculateRouteMetrics, clearRoute } =
    useRouteOptimization();

  // Daily weather brief for the route, with an optional suggested order
  const routeBrief = useRouteBrief({
    jobs: selectedJobs,
    homeCoordinates: currentUser?.homeCoordinates,
    recalculateRouteMetrics,
  });

  // Local order (ids) for drag reordering; the jobs themselves always come fresh from the server
  const [localOrder, setLocalOrder] = useState<Array<JobId>>(() =>
    selectedJobs.map((job) => job._id),
  );
  const prevJobIdsRef = useRef<string>("");
  // The order on screen, for route changes that finish later (like Undo)
  const orderRef = useRef(localOrder);

  // Sync local order with server data (only when the ids or their order change)
  useEffect(() => {
    const currentIds = selectedJobs.map((job) => job._id).join(",");
    if (currentIds !== prevJobIdsRef.current) {
      prevJobIdsRef.current = currentIds;
      setLocalOrder(selectedJobs.map((job) => job._id));
    }
  }, [selectedJobs]);

  useEffect(() => {
    orderRef.current = localOrder;
  }, [localOrder]);

  const { removeStop } = useRemoveRouteStop({
    getOrder: () => orderRef.current,
    setOrder: (order) => {
      orderRef.current = order;
      setLocalOrder(order);
    },
    recalculateRouteMetrics,
  });

  // Derived values
  const jobsById = new Map(selectedJobs.map((job) => [job._id, job]));
  const orderedIds = localOrder.filter((id) => jobsById.has(id));
  const orderedJobs = orderedIds.map((id) => jobsById.get(id)!);
  const pendingStops = orderedJobs.filter((job) => !isStopDone(job));
  const isAllDone = isRouteDone(orderedJobs);
  const hasRoute = selectedJobs.length > 0;

  // Handlers
  const handleNavigateRoute = () => {
    // Only the stops still to do; done stops are skipped
    const url = generateGoogleMapsUrl(
      pendingStops,
      true,
      currentUser?.homeCoordinates ?? undefined,
    );
    if (url) {
      openExternal(url);
    }
  };

  const handleEditRouteDone = async (selectedJobIds: Array<JobId>) => {
    try {
      await optimizeAndSaveRoute(selectedJobIds);
    } catch (error) {
      console.error("Route optimization error:", error);
    } finally {
      // Always close the modal - errors are shown via toast
      setEditRouteOpen(false);
    }
  };

  const handleClearRoute = () => {
    if (window.confirm("Clear today's route? The jobs stay in your job list.")) {
      void clearRoute();
    }
  };

  const handleReorderEnd = () => {
    // Only recalculate if order actually changed
    const originalOrderIds = selectedJobs.map((job) => job._id);
    const orderChanged = localOrder.some((id, index) => id !== originalOrderIds[index]);

    if (orderChanged && localOrder.length >= 2) {
      void recalculateRouteMetrics(localOrder);
    }
  };

  return (
    <div className="space-y-6">
      <JobDetailSheet
        jobId={jobSheet.jobId}
        open={jobSheet.isOpen}
        onOpenChange={jobSheet.handleOpenChange}
        tab={jobSheet.tab}
        onTabChange={jobSheet.setTab}
      />
      <EditRouteModal
        open={editRouteOpen}
        onOpenChange={setEditRouteOpen}
        onDone={handleEditRouteDone}
        isOptimizing={isOptimizing}
      />

      <ScanActions />

      {/* Work orders being read */}
      {processingQueue.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Reading work orders</h2>
          <div className="space-y-2">
            {processingQueue.map((item) => (
              <Card
                key={item._id}
                className={cn(
                  "overflow-hidden border py-0 shadow-sm",
                  item.status === "failed" ? "border-destructive/50 bg-destructive/5" : "bg-card",
                )}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {item.status === "failed" ?
                    <AlertCircle className="shrink-0 text-destructive" size={24} />
                  : <Loader2 className="shrink-0 animate-spin text-primary" size={24} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold">{item.fileName}</p>
                    <p className="mt-0.5 text-base text-muted-foreground">
                      {item.status === "failed" ? item.error : "Reading the details..."}
                    </p>
                  </div>
                  {item.status === "failed" && (
                    <button
                      onClick={() => removeQueueItem({ queueId: item._id })}
                      aria-label="Remove"
                      className="-mr-2 flex size-12 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X size={24} />
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <RouteBriefCard routeBrief={routeBrief} />

      {/* Wait for the route before choosing between the empty state and the stops */}
      {!isRouteLoaded ?
        null
      : !hasRoute ?
        <EmptyRouteCard onPlanRoute={() => setEditRouteOpen(true)} onOpenJob={jobSheet.openJob} />
      : <>
          {/* Today's route, in order */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Today's route</h2>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setEditRouteOpen(true)}
                className="h-12 rounded-xl text-base font-bold"
              >
                Edit route
              </Button>
              <Button
                variant="outline"
                onClick={handleClearRoute}
                className="h-12 rounded-xl border-destructive/30 text-base font-bold text-destructive hover:bg-destructive/10"
              >
                Clear route
              </Button>
            </div>

            {routeTotals && selectedJobs.length >= 2 && (
              <RouteSummaryCard
                totalDistance={routeTotals.totalDistance}
                totalDuration={routeTotals.totalDuration}
              />
            )}

            {pendingStops.length >= 2 && (
              <Button
                onClick={handleNavigateRoute}
                variant="secondary"
                className="h-14 w-full gap-2 rounded-xl text-lg font-bold"
              >
                <Navigation className="size-6" />
                Navigate whole route
              </Button>
            )}

            {isAllDone && <AllStopsDoneCard onPlanTomorrow={() => setEditRouteOpen(true)} />}

            {orderedIds.length > 0 && (
              <Reorder.Group
                axis="y"
                values={orderedIds}
                onReorder={setLocalOrder}
                className="space-y-3"
              >
                {orderedJobs.map((job, index) => (
                  <SwipeableRouteCard
                    key={job._id}
                    job={job}
                    stopNumber={index + 1}
                    isDone={isStopDone(job)}
                    arrivalTime={routeBrief.arrivalTimes[job._id]}
                    weatherNote={routeBrief.siteNotes[job._id]}
                    onOpen={() => jobSheet.openJob(job._id)}
                    onReorderEnd={handleReorderEnd}
                    onRemove={() => void removeStop(job)}
                  />
                ))}
              </Reorder.Group>
            )}
          </section>
        </>
      }
    </div>
  );
}
