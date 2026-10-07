import { Car, CloudAlert, KeyRound, ListChecks } from "lucide-react";
import { formatDriveTime, formatTasksLeft } from "../lib/today";
import { HourlyForecast } from "./HourlyForecast";
import type { Doc } from "../../../../convex/_generated/dataModel";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Job = Doc<"jobs">;

interface RouteJobCardProps {
  job: Job;
  onClick?: () => void;
  className?: string;
  // Gate/lockbox codes, drive time and tasks left, for stops on today's route
  showRouteDetails?: boolean;
  // Hourly weather at the job site, for jobs that are in today's route
  showForecast?: boolean;
  // Estimated arrival (ms), highlighted in the hourly forecast
  arrivalTime?: number;
  // One line from today's weather brief about this stop
  weatherNote?: string;
}

export function RouteJobCard({
  job,
  onClick,
  className,
  showRouteDetails,
  showForecast,
  arrivalTime,
  weatherNote,
}: RouteJobCardProps) {
  const completedTasks = job.tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = job.tasks?.length ?? 0;
  const progressValue = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const accessCodes = showRouteDetails ? (job.accessCodes ?? []) : [];
  const driveTime = showRouteDetails ? formatDriveTime(job.travelTimeValue) : null;
  const tasksLeft = showRouteDetails ? formatTasksLeft(job.tasks) : null;

  return (
    <Card
      className={cn("overflow-hidden border border-border bg-card py-0 shadow-sm", className)}
      onClick={onClick}
    >
      <CardContent className="space-y-2 p-4">
        {/* Address */}
        <h3 className="line-clamp-2 text-lg font-black uppercase leading-tight text-foreground">
          {job.address}
        </h3>

        {/* Gate and lockbox codes, readable without opening the job */}
        {accessCodes.length > 0 && (
          <ul aria-label="Codes" className="flex flex-wrap gap-2 pt-1">
            {accessCodes.map((code) => (
              <li
                key={code}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted px-3 font-mono text-xl font-black tracking-wider text-foreground"
              >
                <KeyRound size={20} className="shrink-0 text-muted-foreground" />
                {code}
              </li>
            ))}
          </ul>
        )}

        {/* Summary (2 lines max) */}
        {job.summary && (
          <p className="line-clamp-2 text-base text-muted-foreground">{job.summary}</p>
        )}

        {(driveTime || tasksLeft) && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-semibold text-foreground">
            {driveTime && (
              <span className="inline-flex items-center gap-1.5">
                <Car size={20} className="shrink-0 text-muted-foreground" />
                {driveTime}
              </span>
            )}
            {tasksLeft && (
              <span className="inline-flex items-center gap-1.5">
                <ListChecks size={20} className="shrink-0 text-muted-foreground" />
                {tasksLeft}
              </span>
            )}
          </p>
        )}

        {showForecast && (
          <HourlyForecast
            coordinates={job.coordinates}
            arrivalTime={arrivalTime}
            className="my-3"
          />
        )}

        {weatherNote && (
          <p className="flex items-start gap-2 text-base font-medium leading-snug text-amber-700 dark:text-amber-400">
            <CloudAlert size={20} className="mt-0.5 shrink-0" />
            {weatherNote}
          </p>
        )}

        {/* Progress bar, with the count when there's no tasks-left line */}
        {totalTasks > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={progressValue} className="h-1.5 flex-1 bg-muted" />
            {!tasksLeft && (
              <span className="shrink-0 text-xs font-black uppercase tracking-widest text-muted-foreground">
                {completedTasks}/{totalTasks}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
