import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplet,
  Moon,
  Sun,
} from "lucide-react";
import { useHourlyForecast } from "../hooks/useHourlyForecast";
import type { LucideIcon } from "lucide-react";

import type { Coordinates, HourlyForecastSlot } from "@/server/weather";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Only call out rain when it's reasonably likely
const PRECIP_THRESHOLD = 20;

function getWeatherIcon(code: number, isDay: boolean): { Icon: LucideIcon; className: string } {
  // Open-Meteo WMO codes: https://open-meteo.com/en/docs
  if (code === 0) {
    return isDay ?
        { Icon: Sun, className: "text-amber-500" }
      : { Icon: Moon, className: "text-indigo-400" };
  }
  if (code <= 2) {
    return isDay ?
        { Icon: CloudSun, className: "text-amber-500" }
      : { Icon: CloudMoon, className: "text-indigo-400" };
  }
  if (code === 3) return { Icon: Cloud, className: "text-slate-400" };
  if (code <= 48) return { Icon: CloudFog, className: "text-slate-400" };
  if (code <= 57) return { Icon: CloudDrizzle, className: "text-sky-500" };
  if (code <= 67) return { Icon: CloudRain, className: "text-sky-500" };
  if (code <= 77) return { Icon: CloudSnow, className: "text-sky-400 dark:text-sky-300" };
  if (code <= 82) return { Icon: CloudRain, className: "text-sky-500" };
  if (code <= 86) return { Icon: CloudSnow, className: "text-sky-400 dark:text-sky-300" };
  return { Icon: CloudLightning, className: "text-violet-500" };
}

function formatHour(time: number) {
  return new Date(time).toLocaleTimeString([], { hour: "numeric" });
}

interface HourlyForecastProps {
  coordinates: Coordinates | undefined;
  className?: string;
}

export function HourlyForecast({ coordinates, className }: HourlyForecastProps) {
  const { slots, isLoading } = useHourlyForecast(coordinates);

  // Keep the columns aligned: show the rain row for every hour, or for none
  const hasRainChance = slots?.some((slot) => slot.precipProb >= PRECIP_THRESHOLD) ?? false;

  if (isLoading) return <Skeleton className={cn("h-[76px]", className)} />;
  if (!slots) return null;

  return (
    <div className={cn("grid grid-cols-5 gap-1 rounded-xl bg-muted/50 p-1", className)}>
      {slots.map((slot, index) => (
        <ForecastSlot
          key={slot.time}
          slot={slot}
          isNow={index === 0}
          showRainChance={hasRainChance}
        />
      ))}
    </div>
  );
}

interface ForecastSlotProps {
  slot: HourlyForecastSlot;
  isNow: boolean;
  showRainChance: boolean;
}

function ForecastSlot({ slot, isNow, showRainChance }: ForecastSlotProps) {
  const { Icon, className: iconClassName } = getWeatherIcon(slot.code, slot.isDay);
  const label = isNow ? "Now" : formatHour(slot.time);

  return (
    <div
      aria-label={`${label}: ${slot.temp}°, ${slot.condition}, ${slot.precipProb}% chance of rain`}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg py-1.5",
        isNow && "bg-card shadow-sm",
      )}
    >
      <span
        className={cn(
          "text-xs font-bold whitespace-nowrap",
          isNow ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <Icon size={22} strokeWidth={2.25} className={iconClassName} />
      <span className="text-base font-black leading-none text-foreground">{slot.temp}°</span>
      {showRainChance && (
        <span
          className={cn(
            "flex items-center gap-0.5 text-xs font-bold leading-none text-sky-600 dark:text-sky-400",
            slot.precipProb < PRECIP_THRESHOLD && "invisible",
          )}
        >
          <Droplet size={10} strokeWidth={3} className="fill-current" />
          {slot.precipProb}%
        </span>
      )}
    </div>
  );
}
