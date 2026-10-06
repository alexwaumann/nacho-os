import { useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "starting" | "recording";

// iOS Safari only records audio/mp4; Chrome 126+ does too. Gemini accepts both mp4 and webm.
const MIME_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

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
  /** Released too soon to have said anything (including while the mic permission prompt was up). */
  onTooShort: () => void;
  onError: (error: unknown) => void;
  minMs?: number;
  maxMs?: number;
}

/**
 * Press-and-hold recording: call start() on press and stop() on release. Handles release
 * before the mic is ready and caps the length so a stuck press can't record forever.
 */
export function useVoiceRecorder({
  onRecorded,
  onTooShort,
  onError,
  minMs = 600,
  maxMs = 60_000,
}: UseVoiceRecorderOptions) {
  const [state, setState] = useState<RecorderState>("idle");
  const sessionRef = useRef<RecordingSession | null>(null);

  const finish = (session: RecordingSession) => {
    session.stream?.getTracks().forEach((track) => track.stop());
    window.clearTimeout(session.timer);
    if (sessionRef.current === session) sessionRef.current = null;
    setState("idle");
  };

  const stop = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.isStopRequested = true;
    if (session.recorder?.state === "recording") session.recorder.stop();
  };

  const cancel = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.isCancelled = true;
    stop();
  };

  const start = async () => {
    if (sessionRef.current) return;
    const session: RecordingSession = { startedAt: 0, isStopRequested: false, isCancelled: false };
    sessionRef.current = session;
    setState("starting");

    try {
      session.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      finish(session);
      onError(error);
      return;
    }

    if (session.isStopRequested) {
      finish(session);
      if (!session.isCancelled) onTooShort();
      return;
    }

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(session.stream, mimeType ? { mimeType } : undefined);
    const chunks: Array<Blob> = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      finish(session);
      if (session.isCancelled) return;
      if (Date.now() - session.startedAt < minMs) {
        onTooShort();
        return;
      }
      onRecorded(new Blob(chunks, { type: recorder.mimeType || mimeType }));
    };

    session.recorder = recorder;
    recorder.start();
    session.startedAt = Date.now();
    session.timer = window.setTimeout(stop, maxMs);
    setState("recording");
  };

  // Release the mic if the sheet closes mid-recording
  useEffect(() => cancel, []);

  return { state, start, stop, cancel };
}
