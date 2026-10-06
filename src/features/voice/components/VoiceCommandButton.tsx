import { Loader2, Mic } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import type { Doc } from "../../../../convex/_generated/dataModel";

import { cn } from "@/lib/utils";

const HINT_MS = 2500;

interface VoiceCommandButtonProps {
  job: Doc<"jobs">;
}

// Floating press-and-hold mic: hold, say what changed on the job, let go
export function VoiceCommandButton({ job }: VoiceCommandButtonProps) {
  const [isHintVisible, setIsHintVisible] = useState(false);
  const { isProcessing, handleRecorded } = useVoiceCommand(job);
  const recorder = useVoiceRecorder({
    onRecorded: (audio) => void handleRecorded(audio),
    onTooShort: () => {
      setIsHintVisible(true);
      window.setTimeout(() => setIsHintVisible(false), HINT_MS);
    },
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
  const label =
    isProcessing ? "Updating job…"
    : recorder.state === "starting" ? "Starting mic…"
    : isRecording ? "Listening… let go when done"
    : isHintVisible ? "Hold the button while you talk"
    : null;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || isProcessing) return;
    // Keep the release on this button even if the finger drifts off it
    e.currentTarget.setPointerCapture(e.pointerId);
    void recorder.start();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat && !isProcessing) {
      e.preventDefault();
      void recorder.start();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") recorder.stop();
  };

  return (
    <div className="pointer-events-none absolute bottom-6 right-5 z-30 flex flex-col items-end gap-3">
      {label && (
        <div
          role="status"
          className="rounded-2xl bg-foreground px-4 py-2.5 text-base font-bold text-background shadow-lg"
        >
          {label}
        </div>
      )}
      <button
        type="button"
        data-vaul-no-drag
        aria-label="Hold to talk"
        aria-pressed={isRecording}
        disabled={isProcessing}
        onPointerDown={handlePointerDown}
        onPointerUp={recorder.stop}
        onPointerCancel={recorder.cancel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "pointer-events-auto relative flex h-20 w-20 touch-none select-none items-center justify-center rounded-full shadow-xl transition-all [-webkit-touch-callout:none]",
          isRecording ?
            "scale-110 bg-destructive text-white"
          : "bg-primary text-primary-foreground active:scale-95",
          isProcessing && "opacity-80",
        )}
      >
        {isRecording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-40" />
        )}
        {isProcessing ?
          <Loader2 className="relative h-9 w-9 animate-spin" />
        : <Mic className="relative h-9 w-9" />}
      </button>
    </div>
  );
}
