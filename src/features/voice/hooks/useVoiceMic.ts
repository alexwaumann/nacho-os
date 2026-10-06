import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cancelSpeech, primeSpeech } from "../lib/speech";
import { useVoiceRecorder } from "./useVoiceRecorder";

const HINT_MS = 2500;
export const MAX_RECORDING_MS = 60_000;
// Start counting down this long before the recording sends itself
export const COUNTDOWN_MS = 10_000;

export const discardedToast = (description: string) =>
  toast("Recording discarded", {
    description,
    classNames: { title: "text-base! font-bold!", description: "text-[15px]!" },
  });

interface UseVoiceMicOptions {
  /** A recording is being sent or applied; taps are ignored meanwhile. */
  isProcessing: boolean;
  onRecorded: (audio: Blob) => void;
}

/**
 * Tap to start, tap again to send: the recorder plus the clock, the too-short hint and the
 * error toasts shared by every mic button.
 */
export function useVoiceMic({ isProcessing, onRecorded }: UseVoiceMicOptions) {
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const recorder = useVoiceRecorder({
    maxMs: MAX_RECORDING_MS,
    onRecorded,
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
  const isStarting = recorder.state === "starting";
  const isIdle = recorder.state === "idle";
  const elapsedMs = recorder.startedAt ? Math.max(now - recorder.startedAt, 0) : 0;
  const remainingMs = MAX_RECORDING_MS - elapsedMs;

  // Tick the recording clock
  useEffect(() => {
    if (!isRecording) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  const handleClick = () => {
    if (isProcessing) return;
    if (isIdle) {
      setIsHintVisible(false);
      // Don't record the last reply being read out; unlock speech on iOS while we have a tap
      cancelSpeech();
      primeSpeech();
      void recorder.start();
    } else if (isRecording) {
      recorder.stop();
    } else {
      // Tapped again while the mic was still starting
      recorder.cancel();
    }
  };

  return {
    isRecording,
    isStarting,
    isIdle,
    isProcessing,
    isHintVisible,
    elapsedMs,
    remainingMs,
    handleClick,
    /** Discards the recording in progress; returns whether there was one. */
    cancel: recorder.cancel,
  };
}

export type VoiceMic = ReturnType<typeof useVoiceMic>;
