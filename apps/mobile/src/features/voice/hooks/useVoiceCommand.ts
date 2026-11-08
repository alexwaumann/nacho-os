import { ConvexError } from "convex/values";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import {
  applyVoiceOps,
  buildVoiceContext,
  getVoiceJobState,
  splitVoiceChanges,
} from "@convex/lib/voice/ops";
import type { VoiceJobState } from "@convex/lib/voice/ops";
import { getErrorMessage } from "@shared/errors";
import {
  RESULT_TOAST_MS,
  RETRY_TOAST_MS,
  buildNextFollowUp,
  describeToday,
  formatVoiceResultText,
  getActiveFollowUp,
  newVoiceTaskId,
  toPreviousExchange,
} from "@shared/voice/voiceClient";
import type { PendingFollowUp } from "@shared/voice/voiceClient";
import { toast, toastError } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";

import { showAddPhotoHint } from "../lib/photoRequest";
import type { VoiceAudio } from "../lib/voiceAudio";
import { useSpokenReplies } from "./useSpokenReplies";

/** Why a send failed, in plain words; the recording is kept for Try again either way. */
export function describeSendFailure(error: unknown) {
  if (!(error instanceof ConvexError)) {
    return "Nothing was changed. Check your signal, then tap Try again.";
  }
  const message = getErrorMessage(error).trim();
  return `${message}${/[.!?]$/.test(message) ? "" : "."} Nothing was changed.`;
}

/**
 * Sends a recorded voice command about one job to the voice agent, applies the edits it returns
 * and shows a toast listing them with one Undo for the whole command. The reply is read out
 * loud unless that's turned off. A port of the web app's hook of the same name.
 */
export function useVoiceCommand(job: Doc<"jobs">) {
  const jobId = job._id;
  const { isAuthenticated } = useConvexAuth();
  const runVoiceCommand = useAction(api.voice.runVoiceCommand);
  const updateJob = useMutation(api.jobs.update);
  const updateStatus = useMutation(api.jobs.updateStatus);
  const setCaptions = useMutation(api.jobPhotos.setCaptions);
  // Same query as the job sheet's Photos tab, so it adds no request
  const photos = useQuery(api.jobPhotos.listByJob, isAuthenticated ? { jobId } : "skip");
  const speakReply = useSpokenReplies();
  const [isProcessing, setIsProcessing] = useState(false);
  // The last exchange, so the next recording can answer its question or correct it
  const [followUp, setFollowUp] = useState<PendingFollowUp | null>(null);

  // The reply is applied to the job as it is then, not as it was when he started talking
  const latestRef = useRef({ job, photos });
  useEffect(() => {
    latestRef.current = { job, photos };
  }, [job, photos]);

  useEffect(() => {
    if (!followUp) return;
    const timer = setTimeout(() => setFollowUp(null), followUp.expiresAt - Date.now());
    return () => clearTimeout(timer);
  }, [followUp]);

  const saveFields = async (fields: Partial<VoiceJobState>) => {
    const { job: jobFields, status, photos: captions } = splitVoiceChanges(fields);
    if (Object.keys(jobFields).length > 0) await updateJob({ jobId, ...jobFields });
    if (status) await updateStatus({ jobId, status });
    if (captions) {
      await setCaptions({
        jobId,
        captions: captions.map((photo) => ({ photoId: photo.id, caption: photo.caption })),
      });
    }
  };

  const handleUndo = async (previous: Partial<VoiceJobState>) => {
    try {
      await saveFields(previous);
      toast.success("Undone");
    } catch (error) {
      toastError("Couldn't undo", error);
    }
  };

  const handleRecorded = async (audio: VoiceAudio) => {
    const { job: target, photos: targetPhotos = [] } = latestRef.current;
    const { context, refs } = buildVoiceContext(target, targetPhotos);
    const active = getActiveFollowUp(followUp);
    setIsProcessing(true);

    let result: Awaited<ReturnType<typeof runVoiceCommand>>;
    try {
      result = await runVoiceCommand({
        audio,
        job: context,
        today: describeToday(),
        previous: toPreviousExchange(active),
      });
    } catch (error) {
      console.log("Voice command failed:", error);
      setIsProcessing(false);
      // Nothing was changed yet, so the same recording can safely be sent again
      toast.error("Couldn't send your voice update", {
        description: describeSendFailure(error),
        duration: RETRY_TOAST_MS,
        action: { label: "Try again", onPress: () => void handleRecorded(audio) },
        id: `voice-job-${jobId}`,
      });
      return;
    }

    try {
      const latest = latestRef.current;
      const applied = applyVoiceOps(
        getVoiceJobState(latest.job, latest.photos ?? []),
        result.ops,
        refs,
        () => newVoiceTaskId(),
      );
      // The model occasionally leaves the reply empty
      const title =
        result.reply ||
        (applied.summary.length > 0 ? "Job updated" : "Sorry, I didn't catch that.");
      const nextFollowUp = buildNextFollowUp({
        active,
        transcript: result.transcript,
        reply: result.reply,
        applied: applied.summary,
      });
      const description = formatVoiceResultText({
        lines: applied.summary,
        skipped: applied.skipped,
        transcript: result.transcript,
      });
      const hasChanges = Object.keys(applied.changes).length > 0;

      if (hasChanges) await saveFields(applied.changes);
      setFollowUp(nextFollowUp);
      if (hasChanges) {
        haptics.success();
        toast.success(title, {
          description,
          duration: RESULT_TOAST_MS,
          action: { label: "Undo", onPress: () => void handleUndo(applied.previous) },
          id: `voice-job-${jobId}`,
        });
      } else {
        toast.info(title, { description, duration: RESULT_TOAST_MS, id: `voice-job-${jobId}` });
      }
      speakReply(title);
      if (applied.addPhoto) showAddPhotoHint();
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
