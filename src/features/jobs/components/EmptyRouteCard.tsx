import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Loader2, MapPinned, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getDueBadge, sortJobsByDueDate } from "../lib/dueDate";

import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDueDate } from "@/lib/utils";

type Job = Doc<"jobs">;

const SUGGESTION_COUNT = 3;

interface EmptyRouteCardProps {
  onPlanRoute: () => void;
  onOpenJob: (jobId: Id<"jobs">) => void;
}

/** Today with no stops: a big "Plan today's route" button and the jobs due soonest. */
export function EmptyRouteCard({ onPlanRoute, onOpenJob }: EmptyRouteCardProps) {
  const { data: pendingJobs } = useQuery(convexQuery(api.jobs.list, { status: "pending" }));
  const toggleSelectedForRoute = useMutation(api.jobs.toggleSelectedForRoute);
  const [addingJobId, setAddingJobId] = useState<Id<"jobs"> | null>(null);

  const dueSoonest = sortJobsByDueDate(
    (pendingJobs ?? []).filter((job) => !job.selectedForRoute),
  ).slice(0, SUGGESTION_COUNT);

  const handleAddToRoute = async (job: Job) => {
    setAddingJobId(job._id);
    try {
      await toggleSelectedForRoute({ jobId: job._id, selected: true });
      toast.success("Added to today's route");
    } catch (error) {
      console.error("Add to route failed:", error);
      toast.error("Couldn't add it to the route", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setAddingJobId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-dashed border-border bg-card/50 py-0 shadow-none">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <MapPinned size={44} className="text-muted-foreground" />
          <p className="text-2xl font-black text-foreground">No stops planned for today</p>
          <Button onClick={onPlanRoute} className="h-14 w-full gap-2 rounded-xl text-lg font-bold">
            <Plus className="size-6" />
            Plan today's route
          </Button>
        </CardContent>
      </Card>

      {dueSoonest.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Due soonest</h2>
          {dueSoonest.map((job) => (
            <SuggestedJobRow
              key={job._id}
              job={job}
              isAdding={addingJobId === job._id}
              onOpen={() => onOpenJob(job._id)}
              onAdd={() => handleAddToRoute(job)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getDueLabel(dueDate: string | undefined): string | null {
  if (!dueDate) return null;
  const badge = getDueBadge(dueDate, new Date());
  if (badge === "overdue") return `Overdue (was due ${formatDueDate(dueDate)})`;
  if (badge === "today") return "Due today";
  return `Due ${formatDueDate(dueDate)}`;
}

interface SuggestedJobRowProps {
  job: Job;
  isAdding: boolean;
  onOpen: () => void;
  onAdd: () => void;
}

function SuggestedJobRow({ job, isAdding, onOpen, onAdd }: SuggestedJobRowProps) {
  const dueLabel = getDueLabel(job.dueDate);
  const isOverdue = getDueBadge(job.dueDate, new Date()) === "overdue";

  return (
    <Card className="border border-border bg-card py-0 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <button onClick={onOpen} className="block w-full space-y-1 text-left">
          <p className="text-lg font-black uppercase leading-tight text-foreground">
            {job.address}
          </p>
          {dueLabel && (
            <p
              className={cn(
                "text-base font-semibold",
                isOverdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {dueLabel}
            </p>
          )}
        </button>
        <Button
          onClick={onAdd}
          disabled={isAdding}
          variant="outline"
          className="h-12 w-full gap-2 rounded-xl text-base font-bold"
        >
          {isAdding ?
            <Loader2 className="size-5 animate-spin" />
          : <Plus className="size-5" />}
          Add to route
        </Button>
      </CardContent>
    </Card>
  );
}
