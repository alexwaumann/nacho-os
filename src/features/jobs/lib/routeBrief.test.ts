import { describe, expect, it } from "vitest";

import { buildJobSetKey, buildOrderKey, decideBriefAction, toLocalDateKey } from "./routeBrief";
import type { BriefDecisionInput } from "./routeBrief";

describe("buildJobSetKey", () => {
  it("is the same whatever the order", () => {
    expect(buildJobSetKey(["c", "a", "b"])).toBe("a,b,c");
    expect(buildJobSetKey(["b", "c", "a"])).toBe(buildJobSetKey(["a", "b", "c"]));
  });

  it("changes when a job is added or removed", () => {
    expect(buildJobSetKey(["a", "b"])).not.toBe(buildJobSetKey(["a", "b", "c"]));
  });

  it("doesn't change the input", () => {
    const ids = ["b", "a"];
    buildJobSetKey(ids);
    expect(ids).toEqual(["b", "a"]);
  });

  it("is empty without jobs", () => {
    expect(buildJobSetKey([])).toBe("");
  });
});

describe("buildOrderKey", () => {
  it("keeps the route order", () => {
    expect(buildOrderKey(["c", "a", "b"])).toBe("c,a,b");
    expect(buildOrderKey(["a", "b"])).not.toBe(buildOrderKey(["b", "a"]));
  });
});

describe("toLocalDateKey", () => {
  it("formats the local date", () => {
    expect(toLocalDateKey(new Date(2026, 9, 6, 23, 59).getTime())).toBe("2026-10-06");
    expect(toLocalDateKey(new Date(2026, 0, 2, 0, 0).getTime())).toBe("2026-01-02");
  });
});

describe("decideBriefAction", () => {
  const keys = { jobSetKey: "a,b,c", orderKey: "b,a,c" };
  const base: BriefDecisionInput = { stored: null, ...keys, localHour: 7, hasSites: true };
  const stored = { ...keys, hasSuggestion: false };

  it("generates in the morning when there's no brief yet", () => {
    expect(decideBriefAction(base)).toBe("generate");
  });

  it("only generates on its own from 4 AM until 2 PM", () => {
    expect(decideBriefAction({ ...base, localHour: 3 })).toBe("none");
    expect(decideBriefAction({ ...base, localHour: 4 })).toBe("generate");
    expect(decideBriefAction({ ...base, localHour: 13 })).toBe("generate");
    expect(decideBriefAction({ ...base, localHour: 14 })).toBe("none");
    expect(decideBriefAction({ ...base, localHour: 20 })).toBe("none");
  });

  it("does nothing without a site to check", () => {
    expect(decideBriefAction({ ...base, hasSites: false })).toBe("none");
    expect(decideBriefAction({ ...base, stored, hasSites: false })).toBe("none");
  });

  it("keeps the stored brief for the same jobs, at any hour", () => {
    expect(decideBriefAction({ ...base, stored })).toBe("keep");
    expect(decideBriefAction({ ...base, stored, localHour: 18 })).toBe("keep");
  });

  it("generates again when the set of jobs changes", () => {
    const old = { ...stored, jobSetKey: "a,b" };
    expect(decideBriefAction({ ...base, stored: old })).toBe("generate");
    expect(decideBriefAction({ ...base, stored: old, localHour: 16 })).toBe("none");
  });

  it("clears a suggestion when only the order changes", () => {
    const withSuggestion = { ...stored, hasSuggestion: true, orderKey: "a,b,c" };
    expect(decideBriefAction({ ...base, stored: withSuggestion })).toBe("clear-suggestion");
    expect(decideBriefAction({ ...base, stored: withSuggestion, localHour: 18 })).toBe(
      "clear-suggestion",
    );
  });

  it("keeps the brief when the order changes and there's no suggestion to clear", () => {
    expect(decideBriefAction({ ...base, stored: { ...stored, orderKey: "a,b,c" } })).toBe("keep");
  });

  it("keeps a suggestion while the order is unchanged", () => {
    expect(decideBriefAction({ ...base, stored: { ...stored, hasSuggestion: true } })).toBe("keep");
  });
});
