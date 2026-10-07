import { Car, CloudAlert, KeyRound } from "lucide-react";
import { formatDriveTime } from "../lib/today";
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

        {driveTime && (
          <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Car size={20} className="shrink-0 text-muted-foreground" />
            {driveTime}
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

        {/* Progress bar with the done/total count */}
        {totalTasks > 0 && (
          <div className="flex items-center gap-3">
            <Progress value={progressValue} className="h-2 flex-1 bg-muted" />
            <span className="shrink-0 text-base font-bold tabular-nums text-muted-foreground">
              {completedTasks}/{totalTasks}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
