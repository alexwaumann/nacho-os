import { useMutation as useConvexMutationHook } from "convex/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useNavigate, useRouterState } from "@tanstack/react-router";

import { api } from "../../../../convex/_generated/api";
import { VoiceResultDetails } from "../components/VoiceResultDetails";
import {
  buildGlobalContext,
  buildRouteSelections,
  formatHour,
  planGlobalOps,
  summarizeForecastHour,
} from "../lib/globalOps";
import {
  FOLLOW_UP_MS,
  RESULT_TOAST_MS,
  RETRY_TOAST_MS,
  describeToday,
  isQuestion,
  toVoiceAudio,
  toastClassNames,
} from "../lib/voiceClient";
import { useSpokenReplies } from "./useSpokenReplies";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import type { GlobalJobSheetTab, GlobalPlan, StopWeatherInput } from "../lib/globalOps";
import type { VoiceFollowUp } from "../lib/ops";
import {
  hourlyForecastQueryOptions,
  useCurrentHour,
} from "@/features/jobs/hooks/useHourlyForecast";
import { useRouteOptimization } from "@/features/jobs/hooks/useRouteOptimization";
import { estimateRouteArrivals } from "@/features/jobs/lib/arrival";
import { buildJobSetKey, toLocalDateKey } from "@/features/jobs/lib/routeBrief";
import { runGlobalVoiceCommand } from "@/server/voice";

type Job = Doc<"jobs">;
type JobId = Id<"jobs">;

// Forecasts come from the cache when the Today page already loaded them; don't wait long otherwise
const WEATHER_TIMEOUT_MS = 2500;
const FORECAST_HOURS_SENT = 8;

interface PendingFollowUp extends VoiceFollowUp {
  /** The job the exchange was about, so "it" and "there" resolve next time. */
  focusJobId: JobId | null;
  isQuestion: boolean;
  expiresAt: number;
}

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);

function describeNow() {
  const time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${describeToday()}, ${time}`;
}

/**
 * The global mic's voice agent: sends a recording with every open job and today's route,
 * then carries out what it asks (route changes, statuses, job edits, opening a job), shows a
 * toast with one Undo for the whole command and reads the reply out loud.
 */
export function useGlobalVoiceCommand() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hourStart = useCurrentHour();

  const { data: openJobs = [] } = useQuery(convexQuery(api.jobs.listUnpaid, {}));
  const { data: routeJobs = [] } = useQuery(convexQuery(api.jobs.getSelectedForRoute, {}));
  const routeIds = routeJobs.map((job) => job._id);
  // Same query as the Today page's brief, so it shares the cache
  const hasSites = routeJobs.some((job) => job.coordinates);
  const { data: brief } = useQuery(
    convexQuery(
      api.routeBriefs.getForToday,
      hasSites ? { date: toLocalDateKey(hourStart), jobSetKey: buildJobSetKey(routeIds) } : "skip",
    ),
  );

  const updateJob = useConvexMutationHook(api.jobs.update);
  const updateStatus = useConvexMutationHook(api.jobs.updateStatus);
  const batchUpdateRouteSelection = useConvexMutationHook(api.jobs.batchUpdateRouteSelection);
  const clearRoute = useConvexMutationHook(api.jobs.clearRoute);
  const { optimizeAndSaveRoute, recalculateRouteMetrics } = useRouteOptimization();
  const speakReply = useSpokenReplies();

  const [isProcessing, setIsProcessing] = useState(false);
  const [followUp, setFollowUp] = useState<PendingFollowUp | null>(null);

  useEffect(() => {
    if (!followUp) return;
    const timer = window.setTimeout(() => setFollowUp(null), followUp.expiresAt - Date.now());
    return () => window.clearTimeout(timer);
  }, [followUp]);

  /** Hourly forecast per route stop with coordinates, condensed; empty if it can't be had. */
  const getStopWeather = async (stops: Array<Job>): Promise<Array<StopWeatherInput>> => {
    const arrivals = estimateRouteArrivals(
      hourStart,
      stops.map((job) => job.travelTimeValue),
    );
    const results = await Promise.all(
      stops.map(async (job, index): Promise<StopWeatherInput | null> => {
        if (!job.coordinates) return null;
        try {
          const forecast = await withTimeout(
            queryClient.ensureQueryData(hourlyForecastQueryOptions(job.coordinates, hourStart)),
            WEATHER_TIMEOUT_MS,
          );
          if (!forecast) return null;
          const hours = forecast.hourly
            .filter((slot) => slot.time >= hourStart)
            .slice(0, FORECAST_HOURS_SENT)
            .map(summarizeForecastHour);
          return { jobId: job._id, arrive: formatHour(arrivals[index]), hours };
        } catch (error) {
          console.warn("Forecast for voice context failed:", error);
          return null;
        }
      }),
    );
    return results.filter((stop) => stop !== null);
  };

  const openJobSheet = (jobId: JobId, tab?: GlobalJobSheetTab) => {
    // The Today and Jobs pages host the job sheet; anywhere else goes to Jobs
    if (pathname === "/") {
      void navigate({ to: "/", search: (prev) => ({ ...prev, job: jobId, tab }) });
    } else {
      void navigate({ to: "/jobs", search: (prev) => ({ ...prev, job: jobId, tab }) });
    }
  };

  /** Sets the route to exactly these stops, in order. */
  const writeRoute = async (current: Array<JobId>, next: Array<JobId>) => {
    if (next.length === 0) {
      await clearRoute();
      return;
    }
    await batchUpdateRouteSelection({ selections: buildRouteSelections(current, next) });
  };

  const latestRouteIds = () =>
    (
      queryClient.getQueryData<Array<Job>>(
        convexQuery(api.jobs.getSelectedForRoute, {}).queryKey,
      ) ?? routeJobs
    ).map((job) => job._id);

  const handleUndo = async (plan: GlobalPlan, routeBefore: Array<JobId>) => {
    try {
      for (const { jobId, applied } of plan.edits) {
        await updateJob({ jobId, ...applied.previous });
      }
      for (const { jobId, from } of plan.statuses) {
        await updateStatus({ jobId, status: from });
      }
      if (plan.route || plan.optimize) {
        await writeRoute(latestRouteIds(), routeBefore);
        // Drive times for the old order; runs on its own and reports its own errors
        if (routeBefore.length >= 2) void recalculateRouteMetrics(routeBefore);
      }
      toast("Undone", { classNames: toastClassNames });
    } catch (error) {
      console.error("Voice undo failed:", error);
      toast.error("Couldn't undo", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleRecorded = async (audio: Blob) => {
    const activeFollowUp = followUp && followUp.expiresAt > Date.now() ? followUp : null;
    const previous: VoiceFollowUp | undefined =
      activeFollowUp ?
        {
          transcript: activeFollowUp.transcript,
          reply: activeFollowUp.reply,
          applied: activeFollowUp.applied,
        }
      : undefined;
    // Open jobs plus anything else still on the route (e.g. a paid job he never took off)
    const jobs = [
      ...openJobs,
      ...routeJobs.filter((job) => !openJobs.some((o) => o._id === job._id)),
    ];
    setIsProcessing(true);

    let result: Awaited<ReturnType<typeof runGlobalVoiceCommand>>;
    let refs: ReturnType<typeof buildGlobalContext>["refs"];
    try {
      const [voiceAudio, stops] = await Promise.all([
        toVoiceAudio(audio),
        getStopWeather(routeJobs),
      ]);
      const built = buildGlobalContext({
        jobs,
        route: routeIds,
        focusJobId: activeFollowUp?.focusJobId,
        weather: { headline: brief?.headline, stops },
      });
      refs = built.refs;
      result = await runGlobalVoiceCommand({
        data: { audio: voiceAudio, context: built.context, today: describeNow(), previous },
      });
    } catch (error) {
      console.error("Global voice command failed:", error);
      setIsProcessing(false);
      // Nothing was changed yet, so the same recording can safely be sent again
      toast.error("Couldn't send what you said", {
        description: "Nothing was changed. Check your signal, then tap Try again.",
        duration: RETRY_TOAST_MS,
        classNames: toastClassNames,
        action: { label: "Try again", onClick: () => void handleRecorded(audio) },
      });
      return;
    }

    try {
      // Plan against the latest data in case something changed while the command was processing
      const latestOpen =
        queryClient.getQueryData<Array<Job>>(convexQuery(api.jobs.listUnpaid, {}).queryKey) ??
        openJobs;
      const latestJobs = [
        ...latestOpen,
        ...jobs.filter((job) => !latestOpen.some((o) => o._id === job._id)),
      ];
      const routeBefore = latestRouteIds();
      const plan = planGlobalOps({ jobs: latestJobs, route: routeBefore }, result.ops, refs);

      const hasChanges =
        plan.edits.length > 0 || plan.statuses.length > 0 || !!plan.route || plan.optimize;
      const title = result.reply || (hasChanges ? "Done" : "Sorry, I didn't catch that.");
      const isContinuing = !!previous && !!activeFollowUp?.isQuestion;
      setFollowUp({
        transcript:
          isContinuing ? `${previous.transcript} … ${result.transcript}` : result.transcript,
        reply: result.reply,
        applied: [...(isContinuing ? previous.applied : []), ...plan.summary],
        focusJobId: plan.focusJobId ?? activeFollowUp?.focusJobId ?? null,
        isQuestion: isQuestion(result.reply),
        expiresAt: Date.now() + FOLLOW_UP_MS,
      });

      for (const { jobId, applied } of plan.edits) {
        await updateJob({ jobId, ...applied.changes });
      }
      for (const { jobId, to } of plan.statuses) {
        await updateStatus({ jobId, status: to });
      }
      const routeAfter = plan.route?.after ?? routeBefore;
      if (plan.route) await writeRoute(routeBefore, routeAfter);

      const details = (
        <VoiceResultDetails
          lines={plan.summary}
          skipped={plan.skipped}
          transcript={result.transcript}
          notUndoable={plan.notUndoable}
        />
      );
      if (hasChanges) {
        toast.success(title, {
          description: details,
          duration: RESULT_TOAST_MS,
          classNames: toastClassNames,
          action: { label: "Undo", onClick: () => void handleUndo(plan, routeBefore) },
        });
      } else {
        toast(title, {
          description: details,
          duration: RESULT_TOAST_MS,
          classNames: toastClassNames,
        });
      }
      speakReply(title);

      // These need his location and the maps API, so they run on and report on their own
      if (plan.optimize) {
        void optimizeAndSaveRoute(routeAfter);
      } else if (plan.route && routeAfter.length >= 2) {
        void recalculateRouteMetrics(routeAfter);
      }
      if (plan.open) openJobSheet(plan.open.jobId, plan.open.tab);
    } catch (error) {
      console.error("Saving voice changes failed:", error);
      toast.error("Couldn't save the changes", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    handleRecorded,
    followUpQuestion: followUp?.isQuestion ? followUp.reply : null,
  };
}
