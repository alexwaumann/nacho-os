import { useMutation as useConvexMutationHook } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { applyVoiceOps, buildVoiceContext, getVoiceJobState } from "../lib/ops";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import type { VoiceFollowUp, VoiceJobState } from "../lib/ops";
import { runVoiceCommand } from "@/server/voice";

// Long enough to read the changes and reach for Undo
const RESULT_TOAST_MS = 15_000;
// A failed send waits longer, since the recording is lost once this closes
const RETRY_TOAST_MS = 60_000;
// How long the last exchange is sent along, so the next recording can answer or correct it
const FOLLOW_UP_MS = 2 * 60_000;

interface PendingFollowUp extends VoiceFollowUp {
  /** The reply asked something, so the question is pinned by the mic until answered. */
  isQuestion: boolean;
  expiresAt: number;
}

const toastClassNames = {
  title: "text-base! font-bold! leading-snug!",
  description: "text-[15px]! leading-snug!",
  actionButton: "h-10! px-4! text-base! font-bold! rounded-xl!",
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Local date with weekday so the model can resolve "Friday" or "next week"
function describeToday() {
  const now = new Date();
  const iso = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const long = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${long} (${iso})`;
}

interface VoiceResultDetailsProps {
  lines: Array<string>;
  skipped: Array<string>;
  transcript: string;
}

function VoiceResultDetails({ lines, skipped, transcript }: VoiceResultDetailsProps) {
  return (
    <div className="space-y-2 mt-1">
      {lines.length > 0 && (
        <ul className="space-y-0.5 font-semibold text-foreground">
          {lines.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      )}
      {skipped.length > 0 && (
        <ul className="space-y-0.5 text-destructive">
          {skipped.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      )}
      {transcript && <p className="italic text-muted-foreground">Heard: “{transcript}”</p>}
    </div>
  );
}

/**
 * Sends a recorded voice command about a job to the voice agent, applies the edits it returns
 * and shows a toast listing them with one Undo for the whole command.
 */
export function useVoiceCommand(job: Doc<"jobs">) {
  const queryClient = useQueryClient();
  const updateJob = useConvexMutationHook(api.jobs.update);
  const updateStatus = useConvexMutationHook(api.jobs.updateStatus);
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

  const handleRecorded = async (audio: Blob) => {
    const jobId = job._id;
    const { context, refs } = buildVoiceContext(job);
    const previous =
      followUp && followUp.expiresAt > Date.now() ?
        { transcript: followUp.transcript, reply: followUp.reply, applied: followUp.applied }
      : undefined;
    setIsProcessing(true);
    let result: Awaited<ReturnType<typeof runVoiceCommand>>;
    try {
      result = await runVoiceCommand({
        data: {
          audio: { base64: await blobToBase64(audio), mimeType: audio.type.split(";")[0] },
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
        action: { label: "Try again", onClick: () => void handleRecorded(audio) },
      });
      return;
    }

    try {
      // Apply to the latest job in case it changed while the command was processing
      const latest =
        queryClient.getQueryData<Doc<"jobs">>(convexQuery(api.jobs.get, { jobId }).queryKey) ?? job;
      const applied = applyVoiceOps(getVoiceJobState(latest), result.ops, refs);
      // The model occasionally leaves the reply empty
      const title =
        result.reply ||
        (applied.summary.length > 0 ? "Job updated" : "Sorry, I didn't catch that.");
      // While answering a question, keep the original request so a second question still has it
      const isContinuing = !!previous && !!followUp?.isQuestion;
      const nextFollowUp: PendingFollowUp = {
        transcript:
          isContinuing ? `${previous.transcript} … ${result.transcript}` : result.transcript,
        reply: result.reply,
        applied: [...(isContinuing ? previous.applied : []), ...applied.summary],
        isQuestion: result.reply.trim().endsWith("?"),
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
