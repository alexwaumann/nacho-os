import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";

import { toast, toastError } from "@/components/ui/toast";

import { takeDevClip } from "../lib/devClip";
import type { DevClip } from "../lib/devClip";
import { stopSpeaking } from "../lib/speech";
import { discardRecording, readDevClip, readRecording } from "../lib/voiceAudio";
import type { VoiceAudio } from "../lib/voiceAudio";
import { SIMULATED_RECORDING_URI, useVoiceRecorder } from "./useVoiceRecorder";
import type { RecorderError } from "./useVoiceRecorder";

const HINT_MS = 2500;
export const MAX_RECORDING_MS = 60_000;
// Start counting down this long before the recording sends itself
export const COUNTDOWN_MS = 10_000;

export const discardedToast = (description: string) =>
  toast.info("Recording discarded", { description, id: "voice-discarded" });

function showRecorderError(error: RecorderError, cause?: unknown) {
  if (error === "permission-denied") {
    toast.error("The microphone is turned off", {
      description: "To talk to Nacho, allow the microphone for Nacho OS in Settings.",
      duration: 12_000,
      action: { label: "Settings", onPress: () => void Linking.openSettings() },
      id: "voice-mic-error",
    });
  } else if (error === "not-responding") {
    toast.error("The microphone didn't start", {
      description: "Wait a moment, then tap the mic again.",
      id: "voice-mic-error",
    });
  } else if (error === "busy") {
    toast.info("Already recording", {
      description: "Finish or cancel the other recording first.",
      id: "voice-mic-error",
    });
  } else {
    toastError("The microphone isn't working", cause ?? new Error("No recording"), {
      id: "voice-mic-error",
    });
  }
}

interface UseVoiceMicOptions {
  /** A recording is being sent or applied; taps are ignored meanwhile. */
  isProcessing: boolean;
  onRecorded: (audio: VoiceAudio) => void;
  /** Shown when the mic goes away mid-recording, e.g. "The job was closed, so nothing was sent." */
  closedMessage?: string;
}

/**
 * Tap to start, tap again to send: the recorder plus the clock, the too-short hint and the
 * error toasts shared by both mics. Reading the recording off disk counts as processing.
 */
export function useVoiceMic({ isProcessing, onRecorded, closedMessage }: UseVoiceMicOptions) {
  const [isHintVisible, setIsHintVisible] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // DEV ONLY: the clip this recording sends, taken when it starts so a cancel uses it up too
  const devClipRef = useRef<DevClip | null>(null);

  const handleRecorded = async (uri: string) => {
    setIsReading(true);
    try {
      // DEV ONLY: a clip armed with a nachoos://?voiceClip=… link replaces what the mic heard
      const devClip = __DEV__ ? devClipRef.current : null;
      devClipRef.current = null;
      let audio: VoiceAudio;
      if (devClip) {
        if (uri !== SIMULATED_RECORDING_URI) discardRecording(uri);
        audio = await readDevClip(devClip);
        console.log(`[voice] sending dev clip ${devClip.url} (${audio.base64.length} b64 chars)`);
      } else {
        audio = await readRecording(uri);
      }
      onRecorded(audio);
    } catch (error) {
      toastError("Couldn't read the recording", error);
    } finally {
      setIsReading(false);
    }
  };

  const recorder = useVoiceRecorder({
    maxMs: MAX_RECORDING_MS,
    onRecorded: (uri) => void handleRecorded(uri),
    onTooShort: () => {
      setIsHintVisible(true);
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setIsHintVisible(false), HINT_MS);
    },
    onInterrupted: () => discardedToast("You left the app or a call came in, so nothing was sent."),
    onError: showRecorderError,
    onUnmountDiscard: closedMessage ? () => discardedToast(closedMessage) : undefined,
  });

  const isRecording = recorder.state === "recording";
  const isStarting = recorder.state === "starting";
  const isIdle = recorder.state === "idle";
  const isBusy = isProcessing || isReading;
  const elapsedMs = recorder.startedAt ? Math.max(now - recorder.startedAt, 0) : 0;
  const remainingMs = MAX_RECORDING_MS - elapsedMs;

  // Tick the recording clock
  useEffect(() => {
    if (!isRecording) return;
    // Until the first tick, a stale `now` reads as 0:00
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => () => clearTimeout(hintTimerRef.current), []);

  const handlePress = () => {
    if (isBusy) return;
    if (isIdle) {
      setIsHintVisible(false);
      // Don't record the last reply being read out
      stopSpeaking();
      // DEV ONLY: with a clip armed, skip the microphone (the Simulator's may not work)
      devClipRef.current = __DEV__ ? takeDevClip() : null;
      void recorder.start(!!devClipRef.current);
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
    isProcessing: isBusy,
    isHintVisible,
    elapsedMs,
    remainingMs,
    handlePress,
    /** Stops and sends the recording in progress. */
    send: recorder.stop,
    /** Discards the recording in progress; returns whether there was one. */
    cancel: recorder.cancel,
  };
}

export type VoiceMic = ReturnType<typeof useVoiceMic>;
