import {
  CalendarPlus,
  Car,
  CircleCheckBig,
  Clock,
  CloudAlert,
  FolderOpen,
  KeyRound,
  ListChecks,
  Navigation,
} from "lucide-react";
import { formatArrivalTime } from "../lib/arrival";
import { formatDriveTime, formatTasksLeft } from "../lib/today";
import { HourlyForecast } from "./HourlyForecast";
import type { LucideIcon } from "lucide-react";

import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { openExternal } from "@/lib/openExternal";
import { generateGoogleMapsUrl } from "@/server/geo";

type Job = Doc<"jobs">;

/** Google Maps directions from where he is now to this one stop */
function getDirectionsUrl(job: Job): string {
  const url = generateGoogleMapsUrl([{ coordinates: job.coordinates }], true);
  if (url) return url;
  // No coordinates yet: let Google Maps find the address
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}&travelmode=driving`;
}

interface NextStopCardProps {
  job: Job;
  /** 1-based position in today's route */
  stopNumber: number;
  totalStops: number;
  /** Estimated arrival (ms), from the route brief */
  arrivalTime?: number;
  /** One line from today's weather brief about this stop */
  weatherNote?: string;
  onOpen: () => void;
}

/** The big card at the top of Today: where to go next and what's waiting there. */
export function NextStopCard({
  job,
  stopNumber,
  totalStops,
  arrivalTime,
  weatherNote,
  onOpen,
}: NextStopCardProps) {
  const driveTime = formatDriveTime(job.travelTimeValue);
  const tasksLeft = formatTasksLeft(job.tasks);
  const accessCodes = job.accessCodes ?? [];

  const handleNavigate = () => {
    openExternal(getDirectionsUrl(job));
  };

  return (
    <Card className="border-2 border-primary/40 bg-card py-0 shadow-md">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <h3 className="text-2xl font-black uppercase leading-tight tracking-tight text-foreground">
            {job.address}
          </h3>
          <p className="text-lg font-bold text-primary">
            Stop {stopNumber} of {totalStops}
          </p>
        </div>

        {(driveTime || arrivalTime !== undefined || tasksLeft) && (
          <ul className="space-y-2">
            {driveTime && <Fact icon={Car}>{driveTime}</Fact>}
            {arrivalTime !== undefined && (
              <Fact icon={Clock}>Arrive around {formatArrivalTime(arrivalTime)}</Fact>
            )}
            {tasksLeft && <Fact icon={ListChecks}>{tasksLeft}</Fact>}
          </ul>
        )}

        {accessCodes.length > 0 && (
          <div className="space-y-2">
            <p className="text-base font-bold text-muted-foreground">Codes</p>
            <div className="flex flex-wrap gap-2">
              {accessCodes.map((code) => (
                <span
                  key={code}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-muted px-4 font-mono text-xl font-black tracking-wider text-foreground"
                >
                  <KeyRound size={20} className="shrink-0 text-muted-foreground" />
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        {weatherNote && (
          <p className="flex items-start gap-2 text-lg font-semibold leading-snug text-amber-700 dark:text-amber-400">
            <CloudAlert size={22} className="mt-0.5 shrink-0" />
            {weatherNote}
          </p>
        )}

        <HourlyForecast coordinates={job.coordinates} arrivalTime={arrivalTime} hideArrivalLabel />

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleNavigate} className="h-14 gap-2 rounded-xl text-lg font-bold">
            <Navigation className="size-6" />
            Navigate
          </Button>
          <Button
            onClick={onOpen}
            variant="outline"
            className="h-14 gap-2 rounded-xl text-lg font-bold"
          >
            <FolderOpen className="size-6" />
            Open job
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface FactProps {
  icon: LucideIcon;
  children: React.ReactNode;
}

function Fact({ icon: Icon, children }: FactProps) {
  return (
    <li className="flex items-center gap-3 text-xl font-semibold text-foreground">
      <Icon size={24} className="shrink-0 text-muted-foreground" />
      {children}
    </li>
  );
}

interface AllStopsDoneCardProps {
  onPlanTomorrow: () => void;
}

/** Shown in place of the next stop once every stop on the route is done. */
export function AllStopsDoneCard({ onPlanTomorrow }: AllStopsDoneCardProps) {
  return (
    <Card className="border-2 border-emerald-500/40 bg-emerald-50 py-0 shadow-sm dark:bg-emerald-950/30">
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <CircleCheckBig size={48} className="text-emerald-600 dark:text-emerald-400" />
        <p className="text-2xl font-black text-foreground">All stops done for today</p>
        <Button onClick={onPlanTomorrow} className="h-14 w-full gap-2 rounded-xl text-lg font-bold">
          <CalendarPlus className="size-6" />
          Plan tomorrow
        </Button>
      </CardContent>
    </Card>
  );
}
