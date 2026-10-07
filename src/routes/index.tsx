import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Reorder, useDragControls } from "framer-motion";
import { AlertCircle, Check, GripVertical, Loader2, Navigation, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";

import type { Doc, Id } from "../../convex/_generated/dataModel";
import { JobDetailSheet } from "@/components/JobDetailSheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditRouteModal } from "@/features/jobs/components/EditRouteModal";
import { EmptyRouteCard } from "@/features/jobs/components/EmptyRouteCard";
import { AllStopsDoneCard, NextStopCard } from "@/features/jobs/components/NextStopCard";
import { RouteBriefCard } from "@/features/jobs/components/RouteBriefCard";
import { RouteJobCard } from "@/features/jobs/components/RouteJobCard";
import { RouteSummaryCard } from "@/features/jobs/components/RouteSummaryCard";
import { jobSheetSearchSchema, useJobSheet } from "@/features/jobs/hooks/useJobSheet";
import { useRouteBrief } from "@/features/jobs/hooks/useRouteBrief";
import { useRouteOptimization } from "@/features/jobs/hooks/useRouteOptimization";
import { isStopDone, mergeRestOrder, splitRoute } from "@/features/jobs/lib/today";
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

type Job = Doc<"jobs">;
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

  // Sync local order with server data (only when the ids or their order change)
  useEffect(() => {
    const currentIds = selectedJobs.map((job) => job._id).join(",");
    if (currentIds !== prevJobIdsRef.current) {
      prevJobIdsRef.current = currentIds;
      setLocalOrder(selectedJobs.map((job) => job._id));
    }
  }, [selectedJobs]);

  // Derived values
  const jobsById = new Map(selectedJobs.map((job) => [job._id, job]));
  const orderedJobs = localOrder
    .map((id) => jobsById.get(id))
    .filter((job): job is Job => job !== undefined);
  // The next stop comes from the saved order, so it doesn't jump around mid-drag
  const { next: nextStop, allDone } = splitRoute(selectedJobs);
  const restIds = localOrder.filter((id) => id !== nextStop?._id && jobsById.has(id));
  const pendingStops = orderedJobs.filter((job) => !isStopDone(job));
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

  const handleRestReorder = (newRestIds: Array<JobId>) => {
    setLocalOrder((prev) => mergeRestOrder(prev, nextStop?._id ?? null, newRestIds));
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
          {/* Next stop */}
          <section className="space-y-3">
            {nextStop ?
              <>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Next stop</h2>
                <NextStopCard
                  job={nextStop}
                  stopNumber={localOrder.indexOf(nextStop._id) + 1}
                  totalStops={selectedJobs.length}
                  arrivalTime={routeBrief.arrivalTimes[nextStop._id]}
                  weatherNote={routeBrief.siteNotes[nextStop._id]}
                  onOpen={() => jobSheet.openJob(nextStop._id)}
                />
              </>
            : allDone && <AllStopsDoneCard onPlanTomorrow={() => setEditRouteOpen(true)} />}
          </section>

          {/* Rest of the route */}
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

            {restIds.length > 0 && (
              <Reorder.Group
                axis="y"
                values={restIds}
                onReorder={handleRestReorder}
                className="space-y-3"
              >
                {restIds.map((id) => {
                  const job = jobsById.get(id)!;
                  return (
                    <DraggableRouteCard
                      key={id}
                      job={job}
                      stopNumber={localOrder.indexOf(id) + 1}
                      isDone={isStopDone(job)}
                      onClick={() => jobSheet.openJob(id)}
                      onDragEnd={handleReorderEnd}
                      arrivalTime={routeBrief.arrivalTimes[id]}
                      weatherNote={routeBrief.siteNotes[id]}
                    />
                  );
                })}
              </Reorder.Group>
            )}
          </section>
        </>
      }
    </div>
  );
}

// Draggable route card component using framer-motion Reorder
interface DraggableRouteCardProps {
  job: Job;
  stopNumber: number;
  isDone: boolean;
  onClick: () => void;
  onDragEnd: () => void;
  arrivalTime?: number;
  weatherNote?: string;
}

function DraggableRouteCard({
  job,
  stopNumber,
  isDone,
  onClick,
  onDragEnd,
  arrivalTime,
  weatherNote,
}: DraggableRouteCardProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={job._id}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-stretch gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        isDone && "bg-muted/40",
      )}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}
    >
      {/* Drag Handle - Touch-friendly area */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        aria-label={`Drag to move stop ${stopNumber}`}
        className="flex w-14 cursor-grab touch-none select-none flex-col items-center justify-center bg-muted/30 active:cursor-grabbing"
      >
        <GripVertical size={22} className="text-muted-foreground" />
        <div
          className={cn(
            "mt-2 flex size-8 items-center justify-center rounded-full text-base font-bold",
            isDone ? "bg-emerald-600 text-white" : "bg-primary/10 text-primary",
          )}
        >
          {isDone ?
            <Check size={18} strokeWidth={3} aria-label="Done" />
          : stopNumber}
        </div>
      </div>

      {/* Card Content - Clickable area */}
      <div
        className={cn(
          "flex-1 cursor-pointer transition-transform active:scale-[0.99]",
          isDone && "opacity-60",
        )}
        onClick={onClick}
      >
        <RouteJobCard
          job={job}
          className="rounded-none border-0 bg-transparent shadow-none"
          showForecast={!isDone}
          arrivalTime={isDone ? undefined : arrivalTime}
          weatherNote={isDone ? undefined : weatherNote}
        />
      </div>
    </Reorder.Item>
  );
}
