import { useMutation } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { estimateRouteArrivals, getRouteStartTime } from "../lib/arrival";
import {
  buildJobSetKey,
  buildOrderKey,
  decideBriefAction,
  toLocalDateKey,
} from "../lib/routeBrief";
import { api } from "../../../../convex/_generated/api";
import { useCurrentHour } from "./useHourlyForecast";

import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { Coordinates } from "@/server/weather";
import { generateRouteBrief } from "@/server/routeBrief";

type Job = Doc<"jobs">;

export interface UseRouteBriefOptions {
  /** Today's route jobs, in route order */
  jobs: Array<Job>;
  homeCoordinates?: Coordinates;
  /** Seconds for the drive from the last stop back home, when known */
  homeLegSeconds?: number;
  /** From useRouteOptimization; refreshes drive times after the suggested order is applied */
  recalculateRouteMetrics: (orderedJobIds: Array<Id<"jobs">>) => Promise<void>;
}

export interface RouteBriefSuggestion {
  /** The route jobs in the suggested order */
  jobs: Array<Job>;
  reason: string;
}

export interface UseRouteBriefResult {
  /** Today's brief for the current set of route jobs, or null */
  brief: Doc<"routeBriefs"> | null;
  /** The suggested order, while it still applies and hasn't been dismissed */
  suggestion: RouteBriefSuggestion | null;
  /** One-line weather note per job, from the brief */
  siteNotes: Partial<Record<Id<"jobs">, string>>;
  /** Estimated arrival (ms) per job: next full hour (7 AM at the earliest), drive + 90 min a stop */
  arrivalTimes: Partial<Record<Id<"jobs">, number>>;
  /** Estimated arrival (ms) back home after the last stop; undefined without stops or a drive home */
  homeArrivalTime: number | undefined;
  /** True when at least one route job has coordinates, so the weather can be checked */
  canRefresh: boolean;
  isGenerating: boolean;
  isApplying: boolean;
  /** Message from the last failed generation */
  error: string | null;
  /** Generate (or regenerate) the brief now, whatever the time of day */
  refresh: () => Promise<void>;
  /** "Use this order": reorder the route, refresh drive times, mark the suggestion applied */
  applySuggestion: () => Promise<void>;
  /** "Keep my order" */
  dismissSuggestion: () => Promise<void>;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

/**
 * Today's weather brief for the route. Generates it on its own once per day and set of route
 * jobs (between 4 AM and 2 PM), keeps it when only the order changes (dropping a suggested order
 * that no longer applies), and is safe to mount on the Today page.
 */
export function useRouteBrief({
  jobs,
  homeCoordinates,
  homeLegSeconds,
  recalculateRouteMetrics,
}: UseRouteBriefOptions): UseRouteBriefResult {
  const hourStart = useCurrentHour();
  const date = toLocalDateKey(hourStart);
  const localHour = new Date(hourStart).getHours();

  const jobIds = jobs.map((job) => job._id);
  const jobSetKey = buildJobSetKey(jobIds);
  const orderKey = buildOrderKey(jobIds);
  const hasSites = jobs.some((job) => job.coordinates);

  const briefQuery = useQuery(
    convexQuery(api.routeBriefs.getForToday, hasSites ? { date, jobSetKey } : "skip"),
  );
  const saveBrief = useMutation(api.routeBriefs.save);
  const dismissSuggestionMutation = useMutation(api.routeBriefs.dismissSuggestion);
  const markSuggestionApplied = useMutation(api.routeBriefs.markSuggestionApplied);
  const clearSuggestion = useMutation(api.routeBriefs.clearSuggestion);
  const updateRouteOrder = useMutation(api.jobs.updateRouteOrder);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  // Kept per set of jobs, so an old failure isn't shown once the route changes
  const [failure, setFailure] = useState<{ jobSetKey: string; message: string } | null>(null);
  const error = failure?.jobSetKey === jobSetKey ? failure.message : null;

  // Guards against duplicate generation (concurrent, or re-running on every render)
  const inFlightRef = useRef(false);
  const autoAttemptsRef = useRef(new Set<string>());
  const applyingRef = useRef(false);
  const clearedRef = useRef<string | null>(null);

  const brief = (hasSites && briefQuery.data) || null;
  const isBriefLoaded = hasSites && briefQuery.isSuccess;

  const action =
    isBriefLoaded ?
      decideBriefAction({
        stored: brief && {
          jobSetKey: brief.jobSetKey,
          orderKey: brief.orderKey,
          hasSuggestion: !!brief.suggestion && !brief.suggestionDismissed,
        },
        jobSetKey,
        orderKey,
        localHour,
        hasSites,
      })
    : "none";

  const generate = useCallback(async () => {
    if (inFlightRef.current || !jobs.some((job) => job.coordinates)) return;
    inFlightRef.current = true;
    setIsGenerating(true);
    setFailure(null);

    // Snapshot, so the brief is saved under the jobs it was written for
    const routeJobs = jobs;
    const routeJobIds = routeJobs.map((job) => job._id);
    const now = Date.now();
    const legs = routeJobs.map((job) => job.travelTimeValue);
    const arrivals = estimateRouteArrivals(now, legs);

    try {
      const result = await generateRouteBrief({
        data: {
          today: new Date(now).toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          startTime: getRouteStartTime(now),
          homeCoordinates,
          stops: routeJobs.map((job, index) => ({
            address: job.address,
            coordinates: job.coordinates,
            legSeconds: job.travelTimeValue,
            arrivalTime: arrivals[index],
            pendingTasks: (job.tasks ?? [])
              .filter((task) => !task.completed)
              .map((task) => ({
                taskName: task.taskName,
                category: task.category,
                area: task.area,
                specificInstructions: task.specificInstructions,
              })),
            weatherRisk: job.weatherRisk,
          })),
        },
      });

      await saveBrief({
        date: toLocalDateKey(now),
        jobSetKey: buildJobSetKey(routeJobIds),
        orderKey: buildOrderKey(routeJobIds),
        headline: result.headline,
        severity: result.severity,
        siteNotes: result.siteNotes.map(({ stopIndex, note }) => ({
          jobId: routeJobIds[stopIndex],
          note,
        })),
        suggestion:
          result.suggestion ?
            {
              order: result.suggestion.order.map((stopIndex) => routeJobIds[stopIndex]),
              reason: result.suggestion.reason,
            }
          : undefined,
      });
    } catch (generateError) {
      console.error("Route brief failed:", generateError);
      setFailure({ jobSetKey: buildJobSetKey(routeJobIds), message: errorMessage(generateError) });
    } finally {
      inFlightRef.current = false;
      setIsGenerating(false);
    }
  }, [jobs, homeCoordinates, saveBrief]);

  useEffect(() => {
    if (action === "generate") {
      // Re-runs when the in-flight generation finishes (isGenerating), in case the jobs changed
      if (inFlightRef.current) return;
      // At most one automatic try per day and set of jobs; after a failure the user retries
      const attemptKey = `${date}|${jobSetKey}`;
      if (autoAttemptsRef.current.has(attemptKey)) return;
      autoAttemptsRef.current.add(attemptKey);
      void generate();
      return;
    }

    if (action === "clear-suggestion" && brief && !applyingRef.current) {
      const clearKey = `${brief._id}|${orderKey}`;
      if (clearedRef.current === clearKey) return;
      clearedRef.current = clearKey;
      clearSuggestion({ briefId: brief._id, orderKey }).catch((clearError: unknown) => {
        console.error("Clearing the suggested order failed:", clearError);
      });
    }
  }, [
    action,
    date,
    jobSetKey,
    orderKey,
    brief,
    generate,
    clearSuggestion,
    isGenerating,
    isApplying,
  ]);

  const jobsById = new Map(jobs.map((job) => [job._id, job]));

  let suggestion: RouteBriefSuggestion | null = null;
  if (brief?.suggestion && !brief.suggestionDismissed && brief.orderKey === orderKey) {
    const suggestedJobs = brief.suggestion.order.map((jobId) => jobsById.get(jobId));
    if (suggestedJobs.every((job) => job !== undefined)) {
      suggestion = { jobs: suggestedJobs, reason: brief.suggestion.reason };
    }
  }

  const siteNotes: Partial<Record<Id<"jobs">, string>> = {};
  for (const { jobId, note } of brief?.siteNotes ?? []) siteNotes[jobId] = note;

  // From the start of the hour, so it only changes when the hour turns (matches the brief).
  // Home is one more leg after the last stop (including the time spent there).
  const hasHomeLeg = jobs.length > 0 && homeLegSeconds !== undefined;
  const arrivals = estimateRouteArrivals(hourStart, [
    ...jobs.map((job) => job.travelTimeValue),
    ...(hasHomeLeg ? [homeLegSeconds] : []),
  ]);
  const arrivalTimes: Partial<Record<Id<"jobs">, number>> = {};
  jobs.forEach((job, index) => {
    arrivalTimes[job._id] = arrivals[index];
  });
  const homeArrivalTime = hasHomeLeg ? arrivals[jobs.length] : undefined;

  const applySuggestion = async () => {
    if (!brief?.suggestion || applyingRef.current) return;
    const order = brief.suggestion.order;
    applyingRef.current = true;
    setIsApplying(true);

    try {
      await updateRouteOrder({ orderedJobIds: order });
      await recalculateRouteMetrics(order);
      await markSuggestionApplied({ briefId: brief._id });
    } catch (applyError) {
      console.error("Applying the suggested order failed:", applyError);
      toast.error("Couldn't change the order", { description: errorMessage(applyError) });
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  };

  const dismissSuggestion = async () => {
    if (!brief) return;
    try {
      await dismissSuggestionMutation({ briefId: brief._id });
    } catch (dismissError) {
      console.error("Dismissing the suggested order failed:", dismissError);
      toast.error("Something went wrong", { description: errorMessage(dismissError) });
    }
  };

  return {
    brief,
    suggestion,
    siteNotes,
    arrivalTimes,
    homeArrivalTime,
    canRefresh: hasSites,
    isGenerating,
    isApplying,
    error,
    refresh: generate,
    applySuggestion,
    dismissSuggestion,
  };
}
