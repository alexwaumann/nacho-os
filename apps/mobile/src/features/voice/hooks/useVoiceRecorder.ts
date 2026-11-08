import {
  AudioQuality,
  getRecordingPermissionsAsync,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import type { RecordingOptions, RecordingStatus } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { withTimeout } from "@shared/voice/voiceClient";
import { haptics } from "@/lib/haptics";

import { discardRecording } from "../lib/voiceAudio";

export type RecorderState = "idle" | "starting" | "recording";

// AAC in an .m4a, mono, 32 kbps: plenty for speech (Gemini downsamples to 16 kHz) and small
// enough to upload on a weak signal (~240 KB a minute). Same bitrate as the web app.
const VOICE_RECORDING: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 44_100,
  numberOfChannels: 1,
  bitRate: 32_000,
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
  },
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  web: { mimeType: "audio/mp4", bitsPerSecond: 32_000 },
};

// One mic records at a time, app-wide (the tab bar's and a job sheet's)
let activeSession: object | null = null;

interface RecordingSession {
  startedAt: number;
  isRecording: boolean;
  isStopRequested: boolean;
  isCancelled: boolean;
  /** DEV ONLY: no microphone; a dev clip stands in for the recording (see devClip.ts) */
  isSimulated: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

export type RecorderError = "permission-denied" | "busy" | "not-responding" | "failed";

/** The URI a simulated recording delivers; useVoiceMic swaps in the dev clip. */
export const SIMULATED_RECORDING_URI = "dev-clip://simulated";

// iOS can hang starting the mic (seen in the Simulator); give up rather than spin forever
const START_TIMEOUT_MS = 8000;

interface UseVoiceRecorderOptions {
  /** The file of a finished recording (deleted after reading is up to the caller). */
  onRecorded: (uri: string) => void;
  /** Stopped too soon to have said anything. */
  onTooShort: () => void;
  onError: (error: RecorderError, cause?: unknown) => void;
  /** Discarded because he left the app or iOS took the mic (a call, Siri). */
  onInterrupted: () => void;
  /** The mic went away mid-recording (e.g. the job sheet was closed); it was discarded. */
  onUnmountDiscard?: () => void;
  minMs?: number;
  /** Recording stops (and is sent) after this long, so a forgotten recording can't run on. */
  maxMs?: number;
}

/** Puts the audio session back to playback, so replies are read on the speaker, not the earpiece. */
function releaseRecordingSession() {
  setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch((error: unknown) =>
    console.log("Resetting the audio session failed:", error),
  );
}

/**
 * Tap-to-toggle recording with expo-audio: start() asks for the mic and begins, stop() ends and
 * delivers the file, cancel() discards it. Leaving the app or an interruption discards it too.
 */
export function useVoiceRecorder(options: UseVoiceRecorderOptions) {
  const { minMs = 800, maxMs = 60_000 } = options;
  const [state, setState] = useState<RecorderState>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  // Always call the latest callbacks: the recording may end several renders after it started
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  });
  const statusListenerRef = useRef<(status: RecordingStatus) => void>(() => {});
  const recorder = useAudioRecorder(VOICE_RECORDING, (status) => statusListenerRef.current(status));

  const finish = (session: RecordingSession) => {
    clearTimeout(session.timer);
    if (sessionRef.current === session) sessionRef.current = null;
    if (activeSession === session) activeSession = null;
    setState("idle");
    setStartedAt(null);
  };

  const end = async (session: RecordingSession) => {
    clearTimeout(session.timer);
    const wasRecording = session.isRecording;
    session.isRecording = false;
    let uri: string | null = session.isSimulated ? SIMULATED_RECORDING_URI : null;
    if (wasRecording && !session.isSimulated) {
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch (error) {
        console.log("Stopping the recording failed:", error);
      }
    }
    if (!session.isSimulated) releaseRecordingSession();
    finish(session);

    if (session.isCancelled || !wasRecording) {
      discardRecording(uri);
      return;
    }
    if (Date.now() - session.startedAt < minMs) {
      discardRecording(uri);
      callbacksRef.current.onTooShort();
      return;
    }
    if (!uri) {
      callbacksRef.current.onError("failed");
      return;
    }
    haptics.medium();
    callbacksRef.current.onRecorded(uri);
  };

  const stop = () => {
    const session = sessionRef.current;
    if (!session || session.isStopRequested) return;
    session.isStopRequested = true;
    // Still starting: start() notices and ends it
    if (session.isRecording) void end(session);
  };

  /** Discards the current recording; returns whether there was one. */
  const cancel = () => {
    const session = sessionRef.current;
    if (!session) return false;
    session.isCancelled = true;
    stop();
    return true;
  };

  /** Starts recording; `simulated` (dev only) skips the microphone entirely. */
  const start = async (simulated = false) => {
    if (sessionRef.current) return;
    if (activeSession) {
      callbacksRef.current.onError("busy");
      return;
    }
    const session: RecordingSession = {
      startedAt: 0,
      isRecording: false,
      isStopRequested: false,
      isCancelled: false,
      isSimulated: __DEV__ && simulated,
    };
    sessionRef.current = session;
    activeSession = session;
    setState("starting");

    if (session.isSimulated) {
      console.log("[voice] simulated recording (dev clip armed)");
    } else {
      try {
        let permission = await getRecordingPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await requestRecordingPermissionsAsync();
        }
        if (!permission.granted) {
          finish(session);
          callbacksRef.current.onError("permission-denied");
          return;
        }
        if (session.isStopRequested) {
          finish(session);
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        const isPrepared = await withTimeout(
          recorder.prepareToRecordAsync().then(() => true),
          START_TIMEOUT_MS,
        );
        if (!isPrepared) {
          session.isStopRequested = true;
          releaseRecordingSession();
          finish(session);
          callbacksRef.current.onError("not-responding");
          return;
        }
        // Tapped again (or left the app) while the mic was starting
        if (session.isStopRequested) {
          releaseRecordingSession();
          finish(session);
          return;
        }
        recorder.record();
      } catch (error) {
        releaseRecordingSession();
        finish(session);
        callbacksRef.current.onError("failed", error);
        return;
      }
    }

    session.isRecording = true;
    session.startedAt = Date.now();
    session.timer = setTimeout(stop, maxMs);
    setState("recording");
    setStartedAt(session.startedAt);
    haptics.heavy();
  };

  // iOS took the mic away (a call, Siri) or the recorder failed mid-recording
  useEffect(() => {
    statusListenerRef.current = (status) => {
      if (!status.hasError && !status.mediaServicesDidReset) return;
      console.log("Recording interrupted:", status.error);
      if (cancel()) callbacksRef.current.onInterrupted();
    };
  });

  // Leaving the app (home, lock screen, a call) discards the recording rather than sending half
  // a thought. "inactive" is ignored: the permission prompt and Control Center cause it too.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background" && cancel()) callbacksRef.current.onInterrupted();
    });
    return () => {
      subscription.remove();
      // Release the mic if the button goes away mid-recording (e.g. the job sheet closes)
      const session = sessionRef.current;
      if (session) {
        session.isCancelled = true;
        session.isStopRequested = true;
        clearTimeout(session.timer);
        if (activeSession === session) activeSession = null;
        if (session.isRecording && !session.isSimulated) {
          try {
            // The recorder may already be released by now
            recorder.stop().catch(() => {});
          } catch {}
          releaseRecordingSession();
        }
        callbacksRef.current.onUnmountDiscard?.();
      }
    };
    // Runs once: cancel() only reads refs and the recorder, which lives as long as the component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, startedAt, start, stop, cancel };
}
