import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useEffect, useEffectEvent, useRef } from "react";

import { useSearch } from "@tanstack/react-router";

import { api } from "../../../../convex/_generated/api";
import { useGlobalVoiceCommand } from "../hooks/useGlobalVoiceCommand";
import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { discardedToast, useVoiceMic } from "../hooks/useVoiceMic";
import { VoiceMicButton, VoiceMicDiscardButton, VoiceMicStatus } from "./VoiceMicUI";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import { cn } from "@/lib/utils";

interface GlobalVoiceButtonProps {
  /** Recording, starting or sending: the nav lifts above an open job sheet so he can finish. */
  onActiveChange?: (isActive: boolean) => void;
  className?: string;
}

/**
 * The big mic in the bottom nav, on every page: tap, say anything about the jobs or today's
 * route, tap again to send. With a job open, it talks about that job, like the job's own mic.
 * It lives in the nav, so a recording carries on while he moves between Today and Jobs.
 */
export function GlobalVoiceButton({ onActiveChange, className }: GlobalVoiceButtonProps) {
  const search: { job?: string } = useSearch({ strict: false });
  const openJobId = search.job as Id<"jobs"> | undefined;
  // Same query as the job sheet, so it shares the cache and adds no request
  const { data: openJob } = useQuery({
    ...convexQuery(api.jobs.get, { jobId: openJobId! }),
    enabled: !!openJobId,
  });
  const loadedJob = openJob && openJob._id === openJobId ? openJob : null;

  const global = useGlobalVoiceCommand();
  const jobCommand = useVoiceCommand(loadedJob);
  // The job a recording is about, fixed when it starts (null: the global assistant)
  const scopeRef = useRef<Doc<"jobs"> | null>(null);
  const isProcessing = global.isProcessing || jobCommand.isProcessing;

  const mic = useVoiceMic({
    isProcessing,
    onRecorded: (audio) => {
      const job = scopeRef.current;
      if (job) void jobCommand.handleRecorded(audio, job);
      else void global.handleRecorded(audio);
    },
  });
  const isActive = !mic.isIdle || isProcessing;

  const handleClick = () => {
    if (mic.isIdle && !isProcessing) scopeRef.current = loadedJob;
    mic.handleClick();
  };

  // A recording about a job is discarded when that job is closed, like the job's own mic
  const handleOpenJobChanged = useEffectEvent(() => {
    const scopedJob = scopeRef.current;
    if (!scopedJob || scopedJob._id === openJobId) return;
    if (mic.cancel()) discardedToast("The job was closed, so nothing was sent.");
  });

  useEffect(() => {
    handleOpenJobChanged();
  }, [openJobId]);

  const reportActive = useEffectEvent((active: boolean) => onActiveChange?.(active));

  useEffect(() => {
    reportActive(isActive);
  }, [isActive]);

  const isJobScoped = mic.isIdle && !isProcessing ? !!loadedJob : !!scopeRef.current;

  return (
    <div className={cn("relative flex justify-center", className)}>
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-5 flex -translate-x-1/2 items-center gap-3">
        <VoiceMicStatus
          mic={mic}
          processingLabel={isJobScoped ? "Updating job…" : "Working on it…"}
          sendHint="Tap again to send"
          followUpQuestion={isJobScoped ? jobCommand.followUpQuestion : global.followUpQuestion}
          className="pointer-events-auto w-max max-w-[min(18rem,calc(100vw-7rem))]"
        />
        <VoiceMicDiscardButton mic={mic} />
      </div>
      <VoiceMicButton
        mic={{ ...mic, handleClick }}
        label={loadedJob ? "Talk about this job" : "Talk to Nacho"}
        className="h-18 w-18 border-4 border-background"
      />
    </div>
  );
}
