import { HourlyForecast } from "./HourlyForecast";
import type { Doc } from "../../../../convex/_generated/dataModel";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Job = Doc<"jobs">;

interface RouteJobCardProps {
  job: Job;
  onClick?: () => void;
  className?: string;
  // Hourly weather at the job site, for jobs that are in today's route
  showForecast?: boolean;
}

export function RouteJobCard({ job, onClick, className, showForecast }: RouteJobCardProps) {
  const completedTasks = job.tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = job.tasks?.length ?? 0;
  const progressValue = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Card
      className={`border border-border shadow-sm bg-card py-0 overflow-hidden transition-all ${className ?? ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-2">
        {/* Address */}
        <h3 className="text-base font-bold leading-tight text-foreground line-clamp-2 uppercase">
          {job.address}
        </h3>

        {/* Summary (2 lines max) */}
        {job.summary && <p className="text-sm text-muted-foreground line-clamp-2">{job.summary}</p>}

        {showForecast && <HourlyForecast coordinates={job.coordinates} className="my-3" />}

        {/* Progress bar + count inline */}
        {totalTasks > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={progressValue} className="h-1.5 bg-muted flex-1" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">
              {completedTasks}/{totalTasks}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
