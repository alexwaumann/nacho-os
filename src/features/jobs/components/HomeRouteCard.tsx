import { Car, House } from "lucide-react";
import { formatArrivalTime } from "../lib/arrival";
import { formatDriveTime } from "../lib/today";
import { HourlyForecast } from "./HourlyForecast";

import type { Coordinates } from "@/server/weather";
import { cn } from "@/lib/utils";

interface HomeRouteCardProps {
  homeCoordinates: Coordinates;
  /** Seconds for the drive from the last stop back home, when known */
  driveSeconds?: number;
  /** Estimated arrival (ms) back home, highlighted in the hourly forecast */
  arrivalTime?: number;
  className?: string;
}

/**
 * The ride back home, shown after the last stop on today's route. Lined up with the stop cards
 * but fixed in place: nothing to open, drag, swipe or tick off.
 */
export function HomeRouteCard({
  homeCoordinates,
  driveSeconds,
  arrivalTime,
  className,
}: HomeRouteCardProps) {
  const driveTime = formatDriveTime(driveSeconds);

  return (
    <section
      aria-label="Drive home"
      className={cn(
        "flex items-stretch overflow-hidden rounded-2xl border border-dashed border-border bg-card shadow-sm",
        className,
      )}
    >
      {/* Same column as the stops' drag handle, so the cards line up */}
      <div className="flex w-14 shrink-0 items-center justify-center bg-muted/30">
        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <House size={18} strokeWidth={2.5} aria-hidden />
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2 p-4">
        <h3 className="text-lg font-black uppercase leading-tight text-foreground">Home</h3>

        {driveTime && (
          <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Car size={20} className="shrink-0 text-muted-foreground" />
            {driveTime}
          </p>
        )}

        <HourlyForecast
          coordinates={homeCoordinates}
          arrivalTime={arrivalTime}
          hideArrivalLabel
          className="my-3"
        />

        {arrivalTime !== undefined && (
          <p className="text-base font-semibold text-foreground">
            You get home around {formatArrivalTime(arrivalTime)}
          </p>
        )}
      </div>
    </section>
  );
}
