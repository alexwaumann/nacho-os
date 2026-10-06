import { Cloud, CloudRain, ListOrdered, Loader2, RefreshCw, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UseRouteBriefResult } from "../hooks/useRouteBrief";

import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Severity = NonNullable<Doc<"routeBriefs">["severity"]>;

const SEVERITY_STYLES: Record<Severity, { Icon: LucideIcon; iconClassName: string; card: string }> =
  {
    calm: { Icon: Sun, iconClassName: "text-amber-500", card: "" },
    watch: { Icon: Cloud, iconClassName: "text-slate-500", card: "" },
    act: {
      Icon: CloudRain,
      iconClassName: "text-sky-600 dark:text-sky-400",
      card: "border-amber-500/60 bg-amber-50 dark:bg-amber-950/30",
    },
  };

function formatTime(time: number) {
  return new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface RouteBriefCardProps {
  /** From useRouteBrief, so the Today page can share it with the route cards */
  routeBrief: UseRouteBriefResult;
}

/**
 * Today's weather brief for the route: a plain headline, and a suggested order of stops the
 * user can accept or dismiss with one tap.
 */
export function RouteBriefCard({ routeBrief }: RouteBriefCardProps) {
  const { brief, suggestion, canRefresh, isGenerating, isApplying, error } = routeBrief;

  if (!canRefresh) return null;

  if (!brief) {
    if (isGenerating) {
      return (
        <Card className="border border-border bg-card py-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 size={28} className="shrink-0 animate-spin text-primary" />
            <p className="text-lg font-semibold text-foreground">
              Checking the weather at your stops…
            </p>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card className="border border-destructive/40 bg-destructive/5 py-0 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <p className="text-lg font-semibold text-foreground">
              Couldn't check the weather at your stops.
            </p>
            <Button
              onClick={routeBrief.refresh}
              variant="outline"
              className="h-12 w-full gap-2 rounded-xl text-base font-bold"
            >
              <RefreshCw className="size-5" />
              Try again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Button
        onClick={routeBrief.refresh}
        variant="outline"
        className="h-12 w-full gap-2 rounded-xl text-base font-bold"
      >
        <Cloud className="size-5" />
        Check weather
      </Button>
    );
  }

  const { Icon, iconClassName, card } = SEVERITY_STYLES[brief.severity ?? "watch"];

  return (
    <div className="space-y-3">
      <Card className={cn("border border-border bg-card py-0 shadow-sm", card)}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <Icon size={32} strokeWidth={2.25} className={cn("mt-0.5 shrink-0", iconClassName)} />
            <p className="text-lg font-semibold leading-snug text-foreground">{brief.headline}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-base text-muted-foreground">
              {error ? "Couldn't check again." : `Checked at ${formatTime(brief.generatedAt)}`}
            </span>
            <Button
              onClick={routeBrief.refresh}
              disabled={isGenerating}
              variant="ghost"
              className="h-10 gap-1.5 rounded-full px-3 text-base font-semibold"
            >
              <RefreshCw className={cn("size-5", isGenerating && "animate-spin")} />
              {isGenerating ? "Checking…" : "Check again"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {suggestion && (
        <Card className="border-2 border-primary/50 bg-card py-0 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <ListOrdered size={24} className="shrink-0 text-primary" />
              <h3 className="text-xl font-bold text-foreground">Suggested order</h3>
            </div>

            <p className="text-lg leading-snug text-foreground">{suggestion.reason}</p>

            <ol className="space-y-2">
              {suggestion.jobs.map((job, index) => (
                <li key={job._id} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-lg font-semibold leading-snug text-foreground">
                    {job.address}
                  </span>
                </li>
              ))}
            </ol>

            <div className="grid gap-2">
              <Button
                onClick={routeBrief.applySuggestion}
                disabled={isApplying}
                className="h-14 w-full gap-2 rounded-xl text-lg font-bold"
              >
                {isApplying && <Loader2 className="size-6 animate-spin" />}
                {isApplying ? "Changing the order…" : "Use this order"}
              </Button>
              <Button
                onClick={routeBrief.dismissSuggestion}
                disabled={isApplying}
                variant="outline"
                className="h-14 w-full rounded-xl text-lg font-bold"
              >
                Keep my order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
