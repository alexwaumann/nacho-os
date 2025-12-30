import { useMutation, useQuery } from "convex/react";
import { Reorder, useDragControls } from "framer-motion";
import {
  AlertCircle,
  ClipboardList,
  GripVertical,
  Loader2,
  Navigation,
  Plus,
  Scan,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { createFileRoute } from "@tanstack/react-router";

import { api } from "../../convex/_generated/api";

import type { Doc, Id } from "../../convex/_generated/dataModel";
import { JobDetailSheet } from "@/components/JobDetailSheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditRouteModal } from "@/features/jobs/components/EditRouteModal";
import { RouteJobCard } from "@/features/jobs/components/RouteJobCard";
import { RouteSummaryCard } from "@/features/jobs/components/RouteSummaryCard";
import { useRouteOptimization } from "@/features/jobs/hooks/useRouteOptimization";
import { AddJobModal } from "@/features/jobs/components/AddJobModal";
import { generateGoogleMapsUrl } from "@/server/geo";

const searchSchema = z.object({
  "new-job": z.string().optional(),
  job: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: YouPage,
});

type Job = Doc<"jobs">;

function YouPage() {
  const navigate = Route.useNavigate();
  const { job: jobIdParam } = Route.useSearch();

  // Sync user on first load
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);
  const removeQueueItem = useMutation(api.jobs.removeQueueItem);

  useEffect(() => {
    getOrCreateUser().catch(console.error);
  }, [getOrCreateUser]);

  const selectedJobs = useQuery(api.jobs.getSelectedForRoute) ?? [];
  const routeTotals = useQuery(api.jobs.getRouteTotals);
  const stats = useQuery(api.jobs.getStats);
  const processingQueue = useQuery(api.jobs.listQueue) ?? [];

  // Edit Route Modal state
  const [editRouteOpen, setEditRouteOpen] = useState(false);

  // Job Detail Sheet state
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Route optimization hook
  const { isOptimizing, optimizeAndSaveRoute, recalculateRouteMetrics, clearRoute } =
    useRouteOptimization();

  // Local state for drag reordering
  const [localJobOrder, setLocalJobOrder] = useState<Array<Job>>(selectedJobs);
  const prevJobIdsRef = useRef<string>("");

  // Sync local order with server data (only when job IDs actually change)
  useEffect(() => {
    const currentIds = selectedJobs.map((j) => j._id).join(",");
    if (currentIds !== prevJobIdsRef.current) {
      prevJobIdsRef.current = currentIds;
      setLocalJobOrder(selectedJobs);
    }
  }, [selectedJobs]);

  // Handle URL-based job detail sheet
  useEffect(() => {
    if (jobIdParam) {
      setSelectedJobId(jobIdParam as Id<"jobs">);
      setSheetOpen(true);
    }
  }, [jobIdParam]);

  const handleAddJobClick = () => {
    navigate({
      search: (prev) => ({ ...prev, "new-job": "true" }),
    });
  };

  const handleNavigate = () => {
    if (selectedJobs.length === 0) return;

    const waypoints = selectedJobs
      .filter((j) => j.coordinates)
      .map((j) => ({
        coordinates: j.coordinates!,
      }));

    const url = generateGoogleMapsUrl(waypoints, true);
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleJobClick = (jobId: Id<"jobs">) => {
    setSelectedJobId(jobId);
    setSheetOpen(true);
    navigate({
      search: (prev) => ({ ...prev, job: jobId }),
    });
  };

  const handleSheetClose = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      navigate({
        search: (prev) => {
          const { job: _, ...rest } = prev;
          return rest;
        },
      });
    }
  };

  const handleEditRouteDone = async (selectedJobIds: Array<Id<"jobs">>) => {
    try {
      await optimizeAndSaveRoute(selectedJobIds);
    } catch (error) {
      console.error("Route optimization error:", error);
    } finally {
      // Always close the modal - errors are shown via toast
      setEditRouteOpen(false);
    }
  };

  const handleReorderEnd = () => {
    // Only recalculate if order actually changed
    const newOrderIds = localJobOrder.map((j) => j._id);
    const originalOrderIds = selectedJobs.map((j) => j._id);

    const orderChanged = newOrderIds.some((id, index) => id !== originalOrderIds[index]);

    if (orderChanged && newOrderIds.length >= 2) {
      recalculateRouteMetrics(newOrderIds);
    }
  };

  return (
    <div className="space-y-6">
      <AddJobModal />
      <JobDetailSheet jobId={selectedJobId} open={sheetOpen} onOpenChange={handleSheetClose} />
      <EditRouteModal
        open={editRouteOpen}
        onOpenChange={setEditRouteOpen}
        onDone={handleEditRouteDone}
        isOptimizing={isOptimizing}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-6">
        <Card
          onClick={handleAddJobClick}
          className="border border-border shadow-sm bg-card active:scale-95 transition-transform cursor-pointer group"
        >
          <CardContent className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Plus size={32} strokeWidth={3} />
            </div>
            <span className="font-bold text-foreground">Add Job</span>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card active:scale-95 transition-transform cursor-pointer group">
          <CardContent className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <Scan size={32} strokeWidth={3} />
            </div>
            <span className="font-bold text-foreground">Add Check</span>
          </CardContent>
        </Card>
      </div>

      {/* Processing Queue */}
      {processingQueue.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
            Processing Jobs
          </h3>
          <div className="space-y-2">
            {processingQueue.map((item) => (
              <Card
                key={item._id}
                className={`border shadow-sm overflow-hidden ${
                  item.status === "failed" ? "border-destructive/50 bg-destructive/5" : "bg-card"
                }`}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  {item.status === "failed" ?
                    <AlertCircle className="text-destructive shrink-0" size={20} />
                  : <Loader2 className="text-primary animate-spin shrink-0" size={20} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.status === "failed" ? item.error : "Extracting details..."}
                    </p>
                  </div>
                  {item.status === "failed" && (
                    <button
                      onClick={() => removeQueueItem({ queueId: item._id })}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      <X size={18} />
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Today's Plan */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-foreground">
            <ClipboardList size={24} className="text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">Today's Plan</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditRouteOpen(true)}
              className="text-xs font-bold rounded-full px-4"
            >
              Edit Route
            </Button>
            {selectedJobs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearRoute}
                className="text-xs font-bold rounded-full px-4 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                Clear Route
              </Button>
            )}
          </div>
        </div>

        {/* Route Summary */}
        {routeTotals && selectedJobs.length >= 2 && (
          <RouteSummaryCard
            totalDistance={routeTotals.totalDistance}
            totalDuration={routeTotals.totalDuration}
          />
        )}

        {/* Navigate Button */}
        {selectedJobs.length > 0 && (
          <Button
            onClick={handleNavigate}
            variant="secondary"
            className="w-full h-12 font-bold rounded-xl gap-2"
          >
            <Navigation size={18} />
            Navigate in Google Maps
          </Button>
        )}

        {selectedJobs.length === 0 ?
          <Card className="border-2 border-dashed border-border bg-card/50 shadow-none rounded-2xl">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-muted-foreground font-medium">No stops planned.</p>
              <button
                onClick={() => setEditRouteOpen(true)}
                className="text-primary font-bold hover:underline text-sm"
              >
                Tap to add stops +
              </button>
            </CardContent>
          </Card>
        : <Reorder.Group
            axis="y"
            values={localJobOrder}
            onReorder={setLocalJobOrder}
            className="space-y-3"
          >
            {localJobOrder.map((job, index) => (
              <DraggableRouteCard
                key={job._id}
                job={job}
                index={index}
                onClick={() => handleJobClick(job._id)}
                onDragEnd={handleReorderEnd}
              />
            ))}
          </Reorder.Group>
        }
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Pending
              </p>
              <p className="text-2xl font-black text-foreground">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Done
              </p>
              <p className="text-2xl font-black text-foreground">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Paid
              </p>
              <p className="text-2xl font-black text-emerald-600">{stats.paid}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Draggable route card component using framer-motion Reorder
interface DraggableRouteCardProps {
  job: Job;
  index: number;
  onClick: () => void;
  onDragEnd: () => void;
}

function DraggableRouteCard({ job, index, onClick, onDragEnd }: DraggableRouteCardProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={job}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className="flex items-stretch gap-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}
    >
      {/* Drag Handle - Touch-friendly area */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex flex-col items-center justify-center px-3 bg-muted/30 cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <GripVertical size={20} className="text-muted-foreground" />
        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mt-2">
          {index + 1}
        </div>
      </div>

      {/* Card Content - Clickable area */}
      <div
        className="flex-1 cursor-pointer active:scale-[0.99] transition-transform"
        onClick={onClick}
      >
        <RouteJobCard job={job} className="border-0 shadow-none rounded-none" />
      </div>
    </Reorder.Item>
  );
}
