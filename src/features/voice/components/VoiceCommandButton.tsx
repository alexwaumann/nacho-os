import { Loader2, Mic, Square, X } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import type { Doc } from "../../../../convex/_generated/dataModel";

import { cn } from "@/lib/utils";

const HINT_MS = 2500;
const MAX_RECORDING_MS = 60_000;
// Start counting down this long before the recording sends itself
const COUNTDOWN_MS = 10_000;

const discardedToast = (description: string) =>
  toast("Recording discarded", {
    description,
    classNames: { title: "text-base! font-bold!", description: "text-[15px]!" },
  });

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface VoiceCommandButtonProps {
  job: Doc<"jobs">;
  /** Closing the job sheet discards a recording in progress. */
  isOpen: boolean;
}

// Floating mic: tap, say what changed on the job, tap again to send
export function VoiceCommandButton({ job, isOpen }: VoiceCommandButtonProps) {
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { isProcessing, handleRecorded } = useVoiceCommand(job);
  const recorder = useVoiceRecorder({
    maxMs: MAX_RECORDING_MS,
    onRecorded: (audio) => void handleRecorded(audio),
    onTooShort: () => {
      setIsHintVisible(true);
      window.setTimeout(() => setIsHintVisible(false), HINT_MS);
    },
    onInterrupted: () =>
      discardedToast("The screen turned off or you left the app, so nothing was sent."),
    onError: (error) => {
      console.error("Microphone unavailable:", error);
      const isBlocked = error instanceof DOMException && error.name === "NotAllowedError";
      toast.error(isBlocked ? "Microphone is blocked" : "Microphone unavailable", {
        description:
          isBlocked ?
            "Allow microphone access for this site in Settings, then try again."
          : "This browser can't record audio here.",
      });
    },
  });

  const isRecording = recorder.state === "recording";
  const elapsedMs = recorder.startedAt ? Math.max(now - recorder.startedAt, 0) : 0;
  const remainingMs = MAX_RECORDING_MS - elapsedMs;

  // Tick the recording clock
  useEffect(() => {
    if (!isRecording) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  const handleSheetClosed = useEffectEvent(() => {
    if (recorder.cancel()) discardedToast("The job was closed, so nothing was sent.");
  });

  useEffect(() => {
    if (!isOpen) handleSheetClosed();
  }, [isOpen]);

  const handleClick = () => {
    if (isProcessing) return;
    if (recorder.state === "idle") {
      setIsHintVisible(false);
      void recorder.start();
    } else if (isRecording) {
      recorder.stop();
    } else {
      // Tapped again while the mic was still starting
      recorder.cancel();
    }
  };

  return (
    <div className="pointer-events-none absolute bottom-6 right-5 z-30 flex flex-col items-end gap-3">
      {isRecording ?
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl bg-destructive px-4 py-2.5 text-white shadow-lg"
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-75" />
            <span className="relative h-3 w-3 rounded-full bg-white" />
          </span>
          <div className="leading-tight">
            <div className="text-base font-black tabular-nums">
              Recording {formatElapsed(elapsedMs)}
            </div>
            <div className="text-sm font-semibold text-white/90">
              {remainingMs <= COUNTDOWN_MS ?
                `Sends in ${Math.ceil(remainingMs / 1000)}s`
              : "Tap the square to send"}
            </div>
          </div>
        </div>
      : (isProcessing || recorder.state === "starting" || isHintVisible) && (
          <div
            role="status"
            className="rounded-2xl bg-foreground px-4 py-2.5 text-base font-bold text-background shadow-lg"
          >
            {isProcessing ?
              "Updating job…"
            : recorder.state === "starting" ?
              "Starting mic…"
            : "Too short. Tap, talk, then tap again."}
          </div>
        )
      }
      <div className="flex items-center gap-3">
        {isRecording && (
          <button
            type="button"
            data-vaul-no-drag
            aria-label="Discard recording"
            onClick={() => recorder.cancel()}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-secondary text-foreground shadow-lg active:scale-95"
          >
            <X className="h-7 w-7" />
          </button>
        )}
        <button
          type="button"
          data-vaul-no-drag
          aria-label={isRecording ? "Stop and send" : "Start voice update"}
          aria-pressed={isRecording}
          disabled={isProcessing}
          onClick={handleClick}
          className={cn(
            "pointer-events-auto relative flex h-20 w-20 select-none items-center justify-center rounded-full shadow-xl transition-all active:scale-95",
            isRecording ?
              "bg-destructive text-white ring-4 ring-destructive/30"
            : "bg-primary text-primary-foreground",
            isProcessing && "opacity-80",
          )}
        >
          {isRecording && (
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-30" />
          )}
          {isProcessing || recorder.state === "starting" ?
            <Loader2 className="relative h-9 w-9 animate-spin" />
          : isRecording ?
            <Square className="relative h-8 w-8 fill-current" />
          : <Mic className="relative h-9 w-9" />}
        </button>
      </div>
    </div>
  );
}
