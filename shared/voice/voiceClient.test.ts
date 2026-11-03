import { describe, expect, it, vi } from "vitest";

import {
  FOLLOW_UP_MS,
  audioMimeTypeFor,
  buildNextFollowUp,
  describeNow,
  describeToday,
  formatVoiceResultText,
  getActiveFollowUp,
  isQuestion,
  newVoiceTaskId,
  toPreviousExchange,
  withTimeout,
} from "./voiceClient";
import type { PendingFollowUp } from "./voiceClient";

const followUp = (overrides: Partial<PendingFollowUp> = {}): PendingFollowUp => ({
  transcript: "Add the gate job to my route",
  reply: "Which gate job, Oak Street or Elm?",
  applied: [],
  isQuestion: true,
  expiresAt: 10_000,
  ...overrides,
});

describe("describeToday / describeNow", () => {
  const now = new Date(2026, 10, 3, 14, 5);

  it("gives the long date with the ISO date", () => {
    expect(describeToday(now)).toBe("Tuesday, November 3, 2026 (2026-11-03)");
  });

  it("adds the time for the global assistant", () => {
    expect(describeNow(now)).toBe("Tuesday, November 3, 2026 (2026-11-03), 2:05 PM");
  });
});

describe("isQuestion", () => {
  it("is true only for replies ending in a question mark", () => {
    expect(isQuestion("Which one? ")).toBe(true);
    expect(isQuestion("Done.")).toBe(false);
    expect(isQuestion("")).toBe(false);
  });
});

describe("getActiveFollowUp", () => {
  it("drops an expired follow-up", () => {
    expect(getActiveFollowUp(followUp({ expiresAt: 100 }), 100)).toBeNull();
    expect(getActiveFollowUp(null, 0)).toBeNull();
  });

  it("keeps one that hasn't expired", () => {
    const pending = followUp({ expiresAt: 101 });
    expect(getActiveFollowUp(pending, 100)).toBe(pending);
  });
});

describe("toPreviousExchange", () => {
  it("sends only the exchange fields", () => {
    expect(toPreviousExchange(followUp({ applied: ["Added a note"] }))).toEqual({
      transcript: "Add the gate job to my route",
      reply: "Which gate job, Oak Street or Elm?",
      applied: ["Added a note"],
    });
    expect(toPreviousExchange(null)).toBeUndefined();
  });
});

describe("buildNextFollowUp", () => {
  it("starts fresh without an active question", () => {
    const next = buildNextFollowUp({
      active: followUp({ isQuestion: false, applied: ["Old change"] }),
      transcript: "Mark it done",
      reply: "Marked it done.",
      applied: ["Marked done"],
      now: 1000,
    });
    expect(next).toEqual({
      transcript: "Mark it done",
      reply: "Marked it done.",
      applied: ["Marked done"],
      isQuestion: false,
      expiresAt: 1000 + FOLLOW_UP_MS,
    });
  });

  it("keeps the original request when answering a question", () => {
    const next = buildNextFollowUp({
      active: followUp({ applied: ["Added a note"] }),
      transcript: "Oak Street",
      reply: "Added Oak Street. Anything else?",
      applied: ["Added Oak Street to the route"],
      now: 0,
    });
    expect(next.transcript).toBe("Add the gate job to my route … Oak Street");
    expect(next.applied).toEqual(["Added a note", "Added Oak Street to the route"]);
    expect(next.isQuestion).toBe(true);
  });
});

describe("formatVoiceResultText", () => {
  it("lists changes, skipped items, what Undo can't do and what was heard", () => {
    expect(
      formatVoiceResultText({
        lines: ["Marked “Fix gate” done", "Added a note"],
        skipped: ["No task called “paint”"],
        transcript: " mark the gate done ",
        notUndoable: ["route drive times"],
      }),
    ).toBe(
      [
        "• Marked “Fix gate” done",
        "• Added a note",
        "✕ No task called “paint”",
        "Undo can't take back: route drive times",
        "Heard: “mark the gate done”",
      ].join("\n"),
    );
  });

  it("is empty when there is nothing to say", () => {
    expect(formatVoiceResultText({ lines: [], skipped: [], transcript: "  " })).toBe("");
  });
});

describe("newVoiceTaskId", () => {
  it("is prefixed and differs per call", () => {
    expect(newVoiceTaskId(36, () => 0.5)).toBe("task-voice-10-i");
    expect(newVoiceTaskId()).not.toBe(newVoiceTaskId());
  });
});

describe("audioMimeTypeFor", () => {
  it("maps common extensions, ignoring query strings", () => {
    expect(audioMimeTypeFor("file:///tmp/recording-1.m4a")).toBe("audio/mp4");
    expect(audioMimeTypeFor("http://localhost:8765/clip.wav?x=1")).toBe("audio/wav");
    expect(audioMimeTypeFor("clip.MP3")).toBe("audio/mpeg");
    expect(audioMimeTypeFor("clip.aiff")).toBe("audio/aiff");
    expect(audioMimeTypeFor("no-extension")).toBe("audio/mp4");
  });
});

describe("withTimeout", () => {
  it("resolves with the value when in time", async () => {
    await expect(withTimeout(Promise.resolve(5), 100)).resolves.toBe(5);
  });

  it("resolves null after the timeout", async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise<number>(() => {}), 100);
    vi.advanceTimersByTime(100);
    await expect(result).resolves.toBeNull();
    vi.useRealTimers();
  });

  it("passes errors through", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 100)).rejects.toThrow("boom");
  });
});
