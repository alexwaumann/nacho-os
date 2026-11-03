import { describe, expect, it } from "vitest";

import { describeDueDate, formatDueDate } from "./dueLabel";

const today = new Date(2026, 10, 3, 9, 30);

describe("formatDueDate", () => {
  it("formats an ISO date with the year", () => {
    expect(formatDueDate("2026-11-09")).toMatch(/2026/);
    expect(formatDueDate("2026-11-09")).toMatch(/9/);
  });

  it("keeps free text as it is", () => {
    expect(formatDueDate("next Friday")).toBe("next Friday");
  });
});

describe("describeDueDate", () => {
  it("says when it's due today", () => {
    expect(describeDueDate("2026-11-03", today)).toBe("Due today");
  });

  it("says when it's overdue", () => {
    expect(describeDueDate("2026-11-01", today)).toMatch(/^Overdue \(was due .+\)$/);
  });

  it("gives the date for later due dates and free text", () => {
    expect(describeDueDate("2026-11-09", today)).toMatch(/^Due .*2026/);
    expect(describeDueDate("ASAP", today)).toBe("Due ASAP");
  });

  it("is null without a due date", () => {
    expect(describeDueDate(undefined, today)).toBeNull();
  });
});
