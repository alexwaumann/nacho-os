import { useMutation as useConvexMutationHook } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { VoiceResultDetails } from "../components/VoiceResultDetails";
import { applyVoiceOps, buildVoiceContext, getVoiceJobState } from "../lib/ops";
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

import type { VoiceFollowUp, VoiceJobState } from "../lib/ops";
import { runVoiceCommand } from "@/server/voice";

interface PendingFollowUp extends VoiceFollowUp {
  /** The job it was about; a follow-up only carries over to the same job. */
  jobId: Id<"jobs">;
  /** The reply asked something, so the question is pinned by the mic until answered. */
  isQuestion: boolean;
  expiresAt: number;
}

/**
 * Sends a recorded voice command about a job to the voice agent, applies the edits it returns
 * and shows a toast listing them with one Undo for the whole command. The reply is read out
 * loud unless that's turned off.
 *
 * `job` is the job the mic belongs to; `handleRecorded` can also be given a job, for a mic
 * that isn't tied to one (the global mic while a job is open).
 */
export function useVoiceCommand(job: Doc<"jobs"> | null | undefined) {
  const queryClient = useQueryClient();
  const updateJob = useConvexMutationHook(api.jobs.update);
  const updateStatus = useConvexMutationHook(api.jobs.updateStatus);
  const speakReply = useSpokenReplies();
  const [isProcessing, setIsProcessing] = useState(false);
  // The last exchange, so the next recording can answer its question or correct it
  const [followUp, setFollowUp] = useState<PendingFollowUp | null>(null);

  useEffect(() => {
    if (!followUp) return;
    const timer = window.setTimeout(() => setFollowUp(null), followUp.expiresAt - Date.now());
    return () => window.clearTimeout(timer);
  }, [followUp]);

  const saveFields = async (jobId: Id<"jobs">, fields: Partial<VoiceJobState>) => {
    const { status, ...rest } = fields;
    if (Object.keys(rest).length > 0) await updateJob({ jobId, ...rest });
    if (status) await updateStatus({ jobId, status });
  };

  const handleUndo = async (jobId: Id<"jobs">, previous: Partial<VoiceJobState>) => {
    try {
      await saveFields(jobId, previous);
      toast("Undone", { classNames: toastClassNames });
    } catch (error) {
      console.error("Voice undo failed:", error);
      toast.error("Couldn't undo", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleRecorded = async (audio: Blob, target: Doc<"jobs"> | null | undefined = job) => {
    if (!target) return;
    const jobId = target._id;
    const { context, refs } = buildVoiceContext(target);
    const activeFollowUp =
      followUp && followUp.jobId === jobId && followUp.expiresAt > Date.now() ? followUp : null;
    const previous =
      activeFollowUp ?
        {
          transcript: activeFollowUp.transcript,
          reply: activeFollowUp.reply,
          applied: activeFollowUp.applied,
        }
      : undefined;
    setIsProcessing(true);
    let result: Awaited<ReturnType<typeof runVoiceCommand>>;
    try {
      result = await runVoiceCommand({
        data: {
          audio: await toVoiceAudio(audio),
          job: context,
          today: describeToday(),
          previous,
        },
      });
    } catch (error) {
      console.error("Voice command failed:", error);
      setIsProcessing(false);
      // Nothing was changed yet, so the same recording can safely be sent again
      toast.error("Couldn't send your voice update", {
        description: "Nothing was changed. Check your signal, then tap Try again.",
        duration: RETRY_TOAST_MS,
        classNames: toastClassNames,
        action: { label: "Try again", onClick: () => void handleRecorded(audio, target) },
      });
      return;
    }

    try {
      // Apply to the latest job in case it changed while the command was processing
      const latest =
        queryClient.getQueryData<Doc<"jobs">>(convexQuery(api.jobs.get, { jobId }).queryKey) ??
        target;
      const applied = applyVoiceOps(getVoiceJobState(latest), result.ops, refs);
      // The model occasionally leaves the reply empty
      const title =
        result.reply ||
        (applied.summary.length > 0 ? "Job updated" : "Sorry, I didn't catch that.");
      // While answering a question, keep the original request so a second question still has it
      const isContinuing = !!previous && !!activeFollowUp?.isQuestion;
      const nextFollowUp: PendingFollowUp = {
        jobId,
        transcript:
          isContinuing ? `${previous.transcript} … ${result.transcript}` : result.transcript,
        reply: result.reply,
        applied: [...(isContinuing ? previous.applied : []), ...applied.summary],
        isQuestion: isQuestion(result.reply),
        expiresAt: Date.now() + FOLLOW_UP_MS,
      };
      const details = (
        <VoiceResultDetails
          lines={applied.summary}
          skipped={applied.skipped}
          transcript={result.transcript}
        />
      );

      if (Object.keys(applied.changes).length === 0) {
        setFollowUp(nextFollowUp);
        toast(title, {
          description: details,
          duration: RESULT_TOAST_MS,
          classNames: toastClassNames,
        });
        speakReply(title);
        return;
      }

      await saveFields(jobId, applied.changes);
      setFollowUp(nextFollowUp);
      toast.success(title, {
        description: details,
        duration: RESULT_TOAST_MS,
        classNames: toastClassNames,
        action: { label: "Undo", onClick: () => void handleUndo(jobId, applied.previous) },
      });
      speakReply(title);
    } catch (error) {
      console.error("Saving voice changes failed:", error);
      toast.error("Couldn't save the changes", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isFollowUpForJob = !!followUp && (!job || followUp.jobId === job._id);

  return {
    isProcessing,
    handleRecorded,
    followUpQuestion: isFollowUpForJob && followUp.isQuestion ? followUp.reply : null,
  };
}
