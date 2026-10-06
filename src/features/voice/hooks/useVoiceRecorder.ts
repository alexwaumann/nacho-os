import { useEffect, useEffectEvent, useRef, useState } from "react";

export type RecorderState = "idle" | "starting" | "recording";

// iOS Safari only records audio/mp4; Chrome 126+ does too. Gemini accepts both mp4 and webm.
const MIME_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
// Plenty for speech (Gemini downsamples to 16kHz) and ~4x smaller uploads on a weak signal
const AUDIO_BITS_PER_SECOND = 32_000;

interface RecordingSession {
  stream?: MediaStream;
  recorder?: MediaRecorder;
  startedAt: number;
  isStopRequested: boolean;
  isCancelled: boolean;
  timer?: number;
}

interface UseVoiceRecorderOptions {
  onRecorded: (audio: Blob) => void;
  /** Stopped too soon to have said anything. */
  onTooShort: () => void;
  onError: (error: unknown) => void;
  /** Discarded because the page was hidden (screen off, app switch) or the mic was cut off. */
  onInterrupted: () => void;
  minMs?: number;
  /** Recording stops (and is sent) after this long, so a forgotten recording can't run on. */
  maxMs?: number;
}

/**
 * Tap-to-toggle recording: start() begins, stop() ends and delivers the audio, cancel()
 * discards it. Recordings are discarded when the page is hidden or the mic is taken away.
 */
export function useVoiceRecorder({
  onRecorded,
  onTooShort,
  onError,
  onInterrupted,
  minMs = 800,
  maxMs = 60_000,
}: UseVoiceRecorderOptions) {
  const [state, setState] = useState<RecorderState>("idle");
  // Always call the latest callbacks: the recording may end several renders after it started
  // (the page or the open job can change while he talks)
  const handleRecorded = useEffectEvent((audio: Blob) => onRecorded(audio));
  const handleTooShort = useEffectEvent(() => onTooShort());
  const handleError = useEffectEvent((error: unknown) => onError(error));
  const handleInterrupted = useEffectEvent(() => onInterrupted());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);

  const finish = (session: RecordingSession) => {
    session.stream?.getTracks().forEach((track) => track.stop());
    window.clearTimeout(session.timer);
    if (sessionRef.current === session) sessionRef.current = null;
    setState("idle");
    setStartedAt(null);
  };

  const stop = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.isStopRequested = true;
    if (session.recorder?.state === "recording") session.recorder.stop();
  };

  /** Discards the current recording; returns whether there was one. */
  const cancel = () => {
    const session = sessionRef.current;
    if (!session) return false;
    session.isCancelled = true;
    stop();
    return true;
  };

  const interrupt = useEffectEvent(() => {
    if (cancel()) handleInterrupted();
  });

  const start = async () => {
    if (sessionRef.current) return;
    const session: RecordingSession = { startedAt: 0, isStopRequested: false, isCancelled: false };
    sessionRef.current = session;
    setState("starting");

    try {
      session.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      finish(session);
      handleError(error);
      return;
    }

    // Cancelled while the mic was starting (e.g. tapped again during the permission prompt)
    if (session.isStopRequested) {
      finish(session);
      return;
    }

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(session.stream, {
      mimeType,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    const chunks: Array<Blob> = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      finish(session);
      if (session.isCancelled) return;
      if (Date.now() - session.startedAt < minMs) {
        handleTooShort();
        return;
      }
      handleRecorded(new Blob(chunks, { type: recorder.mimeType || mimeType }));
    };
    // iOS ends the track when a phone call or another app takes the mic
    session.stream.getAudioTracks()[0]?.addEventListener("ended", () => {
      if (cancel()) handleInterrupted();
    });

    session.recorder = recorder;
    recorder.start();
    session.startedAt = Date.now();
    session.timer = window.setTimeout(stop, maxMs);
    setState("recording");
    setStartedAt(session.startedAt);
  };

  // Screen off or switching apps discards the recording rather than sending half a thought
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") interrupt();
    };
    const handlePageHide = () => interrupt();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      // Release the mic if the button goes away mid-recording
      cancel();
    };
  }, []);

  return { state, startedAt, start, stop, cancel };
}
