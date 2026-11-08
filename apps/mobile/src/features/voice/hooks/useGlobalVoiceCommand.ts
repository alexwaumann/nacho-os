import { useAction, useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import {
  buildGlobalContext,
  buildRouteSelections,
  formatHour,
  planGlobalOps,
  summarizeForecastHour,
} from "@convex/lib/voice/globalOps";
import type {
  GlobalJobSheetTab,
  GlobalPlan,
  GlobalRefs,
  StopWeatherInput,
} from "@convex/lib/voice/globalOps";
import { splitVoiceChanges } from "@convex/lib/voice/ops";
import { estimateRouteArrivals } from "@shared/jobs/arrival";
import { buildJobSetKey, toLocalDateKey } from "@shared/jobs/routeBrief";
import {
  RESULT_TOAST_MS,
  RETRY_TOAST_MS,
  buildNextFollowUp,
  describeNow,
  formatVoiceResultText,
  getActiveFollowUp,
  newVoiceTaskId,
  toPreviousExchange,
  withTimeout,
} from "@shared/voice/voiceClient";
import type { PendingFollowUp } from "@shared/voice/voiceClient";
import { toast, toastError } from "@/components/ui/toast";
import { useCurrentHour } from "@/features/route/hooks/useCurrentHour";
import { useRouteOptimization } from "@/features/route/hooks/useRouteOptimization";
import { fetchHourlyForecast } from "@/features/route/lib/forecastCache";
import { haptics } from "@/lib/haptics";

import { showAddPhotoHint } from "../lib/photoRequest";
import type { VoiceAudio } from "../lib/voiceAudio";
import { useSpokenReplies } from "./useSpokenReplies";
import { describeSendFailure } from "./useVoiceCommand";

type Job = Doc<"jobs">;
type JobId = Id<"jobs">;

// Forecasts come from the cache when Today already loaded them; don't wait long otherwise
const WEATHER_TIMEOUT_MS = 2500;
const FORECAST_HOURS_SENT = 8;
const TOAST_ID = "voice-global";

interface GlobalFollowUp extends PendingFollowUp {
  /** The job the exchange was about, so "it" and "there" resolve next time. */
  focusJobId: JobId | null;
}

/**
 * The global mic's voice agent (a port of the web app's hook): sends a recording with every
 * open job and today's route, then carries out what it asks (route changes, statuses, job
 * edits, opening a job), shows a toast with one Undo for the whole command and reads the reply
 * out loud.
 */
export function useGlobalVoiceCommand() {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const hourStart = useCurrentHour();
  const args = isAuthenticated ? {} : "skip";

  const openJobs = useQuery(api.jobs.listUnpaid, args);
  const routeJobs = useQuery(api.jobs.getSelectedForRoute, args);
  const routeIds = (routeJobs ?? []).map((job) => job._id);
  // Same query as Today's weather brief, so it adds no request
  const hasSites = (routeJobs ?? []).some((job) => job.coordinates);
  const brief = useQuery(
    api.routeBriefs.getForToday,
    isAuthenticated && hasSites ?
      { date: toLocalDateKey(hourStart), jobSetKey: buildJobSetKey(routeIds) }
    : "skip",
  );

  const runGlobalVoiceCommand = useAction(api.voice.runGlobalVoiceCommand);
  const updateJob = useMutation(api.jobs.update);
  const updateStatus = useMutation(api.jobs.updateStatus);
  const batchUpdateRouteSelection = useMutation(api.jobs.batchUpdateRouteSelection);
  const clearRoute = useMutation(api.jobs.clearRoute);
  const { optimizeAndSaveRoute, recalculateRouteMetrics } = useRouteOptimization();
  const speakReply = useSpokenReplies();

  const [isProcessing, setIsProcessing] = useState(false);
  const [followUp, setFollowUp] = useState<GlobalFollowUp | null>(null);

  // A reply is applied to the jobs and route as they are then, not when he started talking
  const latestRef = useRef({ openJobs, routeJobs, headline: brief?.headline, hourStart });
  useEffect(() => {
    latestRef.current = { openJobs, routeJobs, headline: brief?.headline, hourStart };
  }, [openJobs, routeJobs, brief?.headline, hourStart]);

  useEffect(() => {
    if (!followUp) return;
    const timer = setTimeout(() => setFollowUp(null), followUp.expiresAt - Date.now());
    return () => clearTimeout(timer);
  }, [followUp]);

  const latestRouteIds = () => (latestRef.current.routeJobs ?? []).map((job) => job._id);

  /** Hourly forecast per route stop with coordinates, condensed; empty if it can't be had. */
  const getStopWeather = async (stops: Job[], start: number): Promise<StopWeatherInput[]> => {
    const arrivals = estimateRouteArrivals(
      start,
      stops.map((job) => job.travelTimeValue),
    );
    const results = await Promise.all(
      stops.map(async (job, index): Promise<StopWeatherInput | null> => {
        if (!job.coordinates) return null;
        try {
          const forecast = await withTimeout(
            fetchHourlyForecast(convex, job.coordinates, start),
            WEATHER_TIMEOUT_MS,
          );
          if (!forecast) return null;
          const hours = forecast.hourly
            .filter((slot) => slot.time >= start)
            .slice(0, FORECAST_HOURS_SENT)
            .map(summarizeForecastHour);
          return { jobId: job._id, arrive: formatHour(arrivals[index]), hours };
        } catch (error) {
          console.log("Forecast for voice context failed:", error);
          return null;
        }
      }),
    );
    return results.filter((stop) => stop !== null);
  };

  const openJobSheet = (jobId: JobId, tab?: GlobalJobSheetTab) => {
    router.push({ pathname: "/job/[id]", params: tab ? { id: jobId, tab } : { id: jobId } });
  };

  /** Sets the route to exactly these stops, in order. */
  const writeRoute = async (current: JobId[], next: JobId[]) => {
    if (next.length === 0) {
      await clearRoute();
      return;
    }
    await batchUpdateRouteSelection({ selections: buildRouteSelections(current, next) });
  };

  const handleUndo = async (plan: GlobalPlan, routeBefore: JobId[]) => {
    try {
      for (const { jobId, applied } of plan.edits) {
        await updateJob({ jobId, ...splitVoiceChanges(applied.previous).job });
      }
      for (const { jobId, from } of plan.statuses) {
        await updateStatus({ jobId, status: from });
      }
      if (plan.route || plan.optimize) {
        await writeRoute(latestRouteIds(), routeBefore);
        // Drive times for the old order; runs on its own and reports its own errors
        if (routeBefore.length >= 1) void recalculateRouteMetrics(routeBefore, { quiet: true });
      }
      toast.success("Undone", { id: TOAST_ID });
    } catch (error) {
      toastError("Couldn't undo", error);
    }
  };

  const handleRecorded = async (audio: VoiceAudio) => {
    const active = getActiveFollowUp(followUp);
    const latest = latestRef.current;
    const open = latest.openJobs ?? [];
    const route = latest.routeJobs ?? [];
    // Open jobs plus anything else still on the route (e.g. a paid job he never took off)
    const jobs = [...open, ...route.filter((job) => !open.some((o) => o._id === job._id))];
    setIsProcessing(true);

    let result: Awaited<ReturnType<typeof runGlobalVoiceCommand>>;
    let refs: GlobalRefs;
    try {
      const stops = await getStopWeather(route, latest.hourStart);
      const built = buildGlobalContext({
        jobs,
        route: route.map((job) => job._id),
        focusJobId: active?.focusJobId,
        weather: { headline: latest.headline, stops },
      });
      refs = built.refs;
      result = await runGlobalVoiceCommand({
        audio,
        context: built.context,
        today: describeNow(),
        previous: toPreviousExchange(active),
      });
    } catch (error) {
      console.log("Global voice command failed:", error);
      setIsProcessing(false);
      // Nothing was changed yet, so the same recording can safely be sent again
      toast.error("Couldn't send what you said", {
        description: describeSendFailure(error),
        duration: RETRY_TOAST_MS,
        action: { label: "Try again", onPress: () => void handleRecorded(audio) },
        id: TOAST_ID,
      });
      return;
    }

    try {
      // Plan against the latest data in case something changed while the command was processing
      const now = latestRef.current;
      const latestOpen = now.openJobs ?? open;
      const latestJobs = [
        ...latestOpen,
        ...jobs.filter((job) => !latestOpen.some((o) => o._id === job._id)),
      ];
      const routeBefore = latestRouteIds();
      const plan = planGlobalOps({ jobs: latestJobs, route: routeBefore }, result.ops, refs, () =>
        newVoiceTaskId(),
      );

      const hasChanges =
        plan.edits.length > 0 || plan.statuses.length > 0 || !!plan.route || plan.optimize;
      const title = result.reply || (hasChanges ? "Done" : "Sorry, I didn't catch that.");
      setFollowUp({
        ...buildNextFollowUp({
          active,
          transcript: result.transcript,
          reply: result.reply,
          applied: plan.summary,
        }),
        focusJobId: plan.focusJobId ?? active?.focusJobId ?? null,
      });

      for (const { jobId, applied } of plan.edits) {
        await updateJob({ jobId, ...splitVoiceChanges(applied.changes).job });
      }
      for (const { jobId, to } of plan.statuses) {
        await updateStatus({ jobId, status: to });
      }
      const routeAfter = plan.route?.after ?? routeBefore;
      if (plan.route) await writeRoute(routeBefore, routeAfter);

      const description = formatVoiceResultText({
        lines: plan.summary,
        skipped: plan.skipped,
        transcript: result.transcript,
        notUndoable: plan.notUndoable,
      });
      if (hasChanges) {
        haptics.success();
        toast.success(title, {
          description,
          duration: RESULT_TOAST_MS,
          action: { label: "Undo", onPress: () => void handleUndo(plan, routeBefore) },
          id: TOAST_ID,
        });
      } else {
        toast.info(title, { description, duration: RESULT_TOAST_MS, id: TOAST_ID });
      }
      speakReply(title);

      // These need his location and the maps API, so they run on and report on their own
      if (plan.optimize) {
        void optimizeAndSaveRoute(routeAfter);
      } else if (plan.route && routeAfter.length >= 1) {
        void recalculateRouteMetrics(routeAfter, { quiet: true });
      }
      if (plan.open) {
        openJobSheet(plan.open.jobId, plan.open.tab);
        if (plan.open.addPhoto) showAddPhotoHint();
      }
    } catch (error) {
      toastError("Couldn't save the changes", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    handleRecorded,
    followUpQuestion: followUp?.isQuestion ? followUp.reply : null,
    dismissFollowUp: () => setFollowUp(null),
  };
}
