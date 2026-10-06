import { Loader2, Mic, Square, X } from "lucide-react";

import { COUNTDOWN_MS } from "../hooks/useVoiceMic";
import type { VoiceMic } from "../hooks/useVoiceMic";

import { cn } from "@/lib/utils";

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface VoiceMicStatusProps {
  mic: VoiceMic;
  /** Shown while the recording is being sent and applied, e.g. "Updating job…". */
  processingLabel: string;
  /** Shown under the clock while recording. */
  sendHint: string;
  /** A question from the last reply, pinned until he answers it. */
  followUpQuestion?: string | null;
  className?: string;
}

/** The pill above a mic: recording clock and countdown, a pending question, or a short status. */
export function VoiceMicStatus({
  mic,
  processingLabel,
  sendHint,
  followUpQuestion,
  className,
}: VoiceMicStatusProps) {
  if (mic.isRecording) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-center gap-3 rounded-2xl bg-destructive px-4 py-2.5 text-white shadow-lg",
          className,
        )}
      >
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-75" />
          <span className="relative h-3 w-3 rounded-full bg-white" />
        </span>
        <div className="leading-tight">
          <div className="text-base font-black tabular-nums">
            Recording {formatElapsed(mic.elapsedMs)}
          </div>
          <div className="text-sm font-semibold text-white/90">
            {mic.remainingMs <= COUNTDOWN_MS ?
              `Sends in ${Math.ceil(mic.remainingMs / 1000)}s`
            : sendHint}
          </div>
        </div>
      </div>
    );
  }

  if (!mic.isProcessing && mic.isIdle && !mic.isHintVisible && followUpQuestion) {
    return (
      <div
        role="status"
        className={cn(
          "max-w-72 rounded-2xl border border-primary/40 bg-card px-4 py-3 shadow-lg",
          className,
        )}
      >
        <p className="text-base font-bold leading-snug text-foreground">{followUpQuestion}</p>
        <p className="mt-1 text-sm font-semibold text-primary">Tap the mic to answer</p>
      </div>
    );
  }

  if (mic.isProcessing || mic.isStarting || mic.isHintVisible) {
    return (
      <div
        role="status"
        className={cn(
          "rounded-2xl bg-foreground px-4 py-2.5 text-base font-bold text-background shadow-lg",
          className,
        )}
      >
        {mic.isProcessing ?
          processingLabel
        : mic.isStarting ?
          "Starting mic…"
        : "Too short. Tap, talk, then tap again."}
      </div>
    );
  }

  return null;
}

interface VoiceMicDiscardButtonProps {
  mic: VoiceMic;
  className?: string;
}

/** Throws the recording away without sending it. Only shown while recording. */
export function VoiceMicDiscardButton({ mic, className }: VoiceMicDiscardButtonProps) {
  if (!mic.isRecording) return null;
  return (
    <button
      type="button"
      data-vaul-no-drag
      aria-label="Discard recording"
      onClick={() => mic.cancel()}
      className={cn(
        "pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-secondary text-foreground shadow-lg active:scale-95",
        className,
      )}
    >
      <X className="h-7 w-7" />
    </button>
  );
}

interface VoiceMicButtonProps {
  mic: VoiceMic;
  /** Accessible name when idle, e.g. "Start voice update". */
  label: string;
  className?: string;
}

/** The round mic: tap to start, shows a square while recording, a spinner while busy. */
export function VoiceMicButton({ mic, label, className }: VoiceMicButtonProps) {
  return (
    <button
      type="button"
      data-vaul-no-drag
      aria-label={mic.isRecording ? "Stop and send" : label}
      aria-pressed={mic.isRecording}
      disabled={mic.isProcessing}
      onClick={mic.handleClick}
      className={cn(
        "pointer-events-auto relative flex h-20 w-20 shrink-0 select-none items-center justify-center rounded-full shadow-xl transition-all active:scale-95",
        mic.isRecording ?
          "bg-destructive text-white ring-4 ring-destructive/30"
        : "bg-primary text-primary-foreground",
        mic.isProcessing && "opacity-80",
        className,
      )}
    >
      {mic.isRecording && (
        <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-30" />
      )}
      {mic.isProcessing || mic.isStarting ?
        <Loader2 className="relative h-9 w-9 animate-spin" />
      : mic.isRecording ?
        <Square className="relative h-8 w-8 fill-current" />
      : <Mic className="relative h-9 w-9" />}
    </button>
  );
}
