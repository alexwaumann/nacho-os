import { useQuery } from "convex/react";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../../../../convex/_generated/api";
import { RouteJobCard } from "./RouteJobCard";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

type Job = Doc<"jobs">;

interface EditRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (selectedJobIds: Array<Id<"jobs">>) => void;
  isOptimizing: boolean;
}

export function EditRouteModal({ open, onOpenChange, onDone, isOptimizing }: EditRouteModalProps) {
  const allPendingJobs = useQuery(api.jobs.list, { status: "pending" }) ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<Id<"jobs">>>(new Set());

  // Initialize selection from jobs that are already selected for route
  useEffect(() => {
    if (open) {
      const alreadySelected = allPendingJobs
        .filter((job) => job.selectedForRoute)
        .map((job) => job._id);
      setSelectedIds(new Set(alreadySelected));
    }
  }, [open, allPendingJobs]);

  const handleToggle = (jobId: Id<"jobs">) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const handleDone = () => {
    onDone(Array.from(selectedIds));
  };

  const handleCardClick = (jobId: Id<"jobs">) => {
    handleToggle(jobId);
  };

  // Don't render anything if not open
  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Sticky Header */}
          <div className="shrink-0 px-5 py-4 border-b border-border bg-background">
            <DialogTitle className="text-xl font-black">Select Stops</DialogTitle>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="space-y-3 pb-4">
              {allPendingJobs.length === 0 ?
                <p className="text-center text-muted-foreground py-8">
                  No pending jobs available. Add jobs first.
                </p>
              : allPendingJobs.map((job) => (
                  <SelectableJobCard
                    key={job._id}
                    job={job}
                    selected={selectedIds.has(job._id)}
                    onClick={() => handleCardClick(job._id)}
                  />
                ))
              }
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="shrink-0 p-5 border-t border-border bg-background safe-area-inset-bottom">
            <Button
              onClick={handleDone}
              disabled={isOptimizing}
              className="w-full h-14 text-base font-bold rounded-2xl"
            >
              {isOptimizing ?
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Optimizing Route...
                </>
              : "Done"}
            </Button>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

interface SelectableJobCardProps {
  job: Job;
  selected: boolean;
  onClick: () => void;
}

function SelectableJobCard({ job, selected, onClick }: SelectableJobCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl transition-all cursor-pointer active:scale-[0.98] ${
        selected ?
          "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md"
        : "opacity-70 grayscale-[0.5]"
      }`}
    >
      <RouteJobCard job={job} className={selected ? "border-primary/50" : "border-border"} />
      {selected && (
        <div className="absolute top-3 left-3 z-10 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
          <Check size={14} strokeWidth={4} />
        </div>
      )}
    </div>
  );
}
