import { describe, expect, it } from "vitest";

import { getDueBadge, sortJobsByDueDate, toLocalIsoDate } from "./dueDate";

// Local-time noon so the calendar date is the same in every timezone
const today = new Date(2026, 9, 6, 12, 0, 0);

describe("toLocalIsoDate", () => {
  it("formats the local calendar date with zero padding", () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("getDueBadge", () => {
  it("marks dates before today as overdue", () => {
    expect(getDueBadge("2026-10-05", today)).toBe("overdue");
    expect(getDueBadge("2025-12-31", today)).toBe("overdue");
  });

  it("marks today's date as due today", () => {
    expect(getDueBadge("2026-10-06", today)).toBe("today");
  });

  it("uses the local date even late at night", () => {
    expect(getDueBadge("2026-10-06", new Date(2026, 9, 6, 23, 59))).toBe("today");
    expect(getDueBadge("2026-10-06", new Date(2026, 9, 7, 0, 1))).toBe("overdue");
  });

  it("shows nothing for future, missing, or free-text dates", () => {
    expect(getDueBadge("2026-10-07", today)).toBeNull();
    expect(getDueBadge(undefined, today)).toBeNull();
    expect(getDueBadge("", today)).toBeNull();
    expect(getDueBadge("next Friday", today)).toBeNull();
  });
});

describe("sortJobsByDueDate", () => {
  it("puts the soonest due date first and jobs without one last", () => {
    const jobs = [
      { id: "none", dueDate: undefined },
      { id: "late", dueDate: "2026-11-01" },
      { id: "early", dueDate: "2026-09-30" },
      { id: "mid", dueDate: "2026-10-06" },
    ];
    expect(sortJobsByDueDate(jobs).map((j) => j.id)).toEqual(["early", "mid", "late", "none"]);
  });

  it("puts free-text dates after real dates but before jobs with no date", () => {
    const jobs: Array<{ id: string; dueDate?: string }> = [
      { id: "none" },
      { id: "text", dueDate: "ASAP" },
      { id: "dated", dueDate: "2026-12-01" },
    ];
    expect(sortJobsByDueDate(jobs).map((j) => j.id)).toEqual(["dated", "text", "none"]);
  });

  it("keeps the original order for ties", () => {
    const jobs: Array<{ id: string; dueDate?: string }> = [
      { id: "a", dueDate: "2026-10-10" },
      { id: "b" },
      { id: "c", dueDate: "2026-10-10" },
      { id: "d" },
    ];
    expect(sortJobsByDueDate(jobs).map((j) => j.id)).toEqual(["a", "c", "b", "d"]);
  });

  it("does not mutate the input", () => {
    const jobs = [{ dueDate: "2026-10-10" }, { dueDate: "2026-10-01" }];
    sortJobsByDueDate(jobs);
    expect(jobs[0].dueDate).toBe("2026-10-10");
  });
});
