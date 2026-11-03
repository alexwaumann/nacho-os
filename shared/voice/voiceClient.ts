// Client-side helpers for voice commands, shared by the web app and the iOS app: the date line
// sent with a recording, follow-up bookkeeping ("which job?" → "Oak Street") and the toast text.

import type { VoiceFollowUp } from "../../convex/lib/voice/ops";

// Long enough to read the changes and reach for Undo
export const RESULT_TOAST_MS = 15_000;
// A failed send waits longer, since the recording is lost once this closes
export const RETRY_TOAST_MS = 60_000;
// How long the last exchange is sent along, so the next recording can answer or correct it
export const FOLLOW_UP_MS = 2 * 60_000;

// Local date with weekday so the model can resolve "Friday" or "next week"
export function describeToday(now = new Date()) {
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

/** The date line plus the time, for the global assistant ("what's next?" depends on it). */
export function describeNow(now = new Date()) {
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${describeToday(now)}, ${time}`;
}

/** A reply that asks something keeps the question pinned by the mic until he answers. */
export const isQuestion = (reply: string) => reply.trim().endsWith("?");

/** The last exchange, kept for a while so the next recording can answer or correct it. */
export interface PendingFollowUp extends VoiceFollowUp {
  /** The reply asked something, so the question is pinned by the mic until answered. */
  isQuestion: boolean;
  expiresAt: number;
}

/** The follow-up if it hasn't expired, else null. */
export function getActiveFollowUp<T extends PendingFollowUp>(
  followUp: T | null,
  now = Date.now(),
): T | null {
  return followUp && followUp.expiresAt > now ? followUp : null;
}

/** What the server gets as `previous`: just the exchange, without the client's bookkeeping. */
export function toPreviousExchange(followUp: PendingFollowUp | null): VoiceFollowUp | undefined {
  if (!followUp) return undefined;
  return { transcript: followUp.transcript, reply: followUp.reply, applied: followUp.applied };
}

interface NextFollowUpInput {
  /** The follow-up that was sent with this recording, if any. */
  active: PendingFollowUp | null;
  transcript: string;
  reply: string;
  /** Summary lines of what this recording changed. */
  applied: Array<string>;
  now?: number;
}

/**
 * The exchange to send with the next recording. While answering a question, the original
 * request and what it already changed are kept, so a second question still has them.
 */
export function buildNextFollowUp({
  active,
  transcript,
  reply,
  applied,
  now = Date.now(),
}: NextFollowUpInput): PendingFollowUp {
  const isContinuing = !!active?.isQuestion;
  return {
    transcript: isContinuing ? `${active.transcript} … ${transcript}` : transcript,
    reply,
    applied: [...(isContinuing ? active.applied : []), ...applied],
    isQuestion: isQuestion(reply),
    expiresAt: now + FOLLOW_UP_MS,
  };
}

interface VoiceResultTextInput {
  /** One line per change made. */
  lines: Array<string>;
  /** Things that couldn't be done. */
  skipped: Array<string>;
  transcript: string;
  /** Changes Undo can't take back. */
  notUndoable?: Array<string>;
}

/** The body of a voice result toast as plain text: the changes, what was skipped, what was heard. */
export function formatVoiceResultText({
  lines,
  skipped,
  transcript,
  notUndoable = [],
}: VoiceResultTextInput) {
  const parts = [
    ...lines.map((line) => `• ${line}`),
    ...skipped.map((line) => `✕ ${line}`),
    ...(notUndoable.length > 0 ? [`Undo can't take back: ${notUndoable.join("; ")}`] : []),
    ...(transcript.trim() ? [`Heard: “${transcript.trim()}”`] : []),
  ];
  return parts.join("\n");
}

/** A task id for tasks added by voice; unique enough without `crypto.randomUUID`. */
export function newVoiceTaskId(now = Date.now(), random = Math.random) {
  return `task-voice-${now.toString(36)}-${random().toString(36).slice(2, 10)}`;
}

/** The audio mime type for a recording's file name ("clip.m4a" → "audio/mp4"). */
export function audioMimeTypeFor(fileName: string) {
  const extension = fileName.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  switch (extension) {
    case "m4a":
    case "mp4":
    case "aac":
      return "audio/mp4";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "aif":
    case "aiff":
      return "audio/aiff";
    case "ogg":
      return "audio/ogg";
    case "webm":
      return "audio/webm";
    default:
      return "audio/mp4";
  }
}

/** Resolves to null when the promise takes longer than `ms` (the promise itself keeps going). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
