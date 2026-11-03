import { describe, expect, it } from "vitest";

import { toIsoDate } from "./date";

const today = new Date(2026, 9, 6, 22, 30); // Oct 6, 2026, 10:30 PM local

describe("toIsoDate", () => {
  it("converts MM/DD/YYYY", () => {
    expect(toIsoDate("3/7/2026", today)).toBe("2026-03-07");
    expect(toIsoDate("12/30/2025", today)).toBe("2025-12-30");
  });

  it("keeps YYYY-MM-DD", () => {
    expect(toIsoDate("2026-10-01", today)).toBe("2026-10-01");
  });

  it("falls back to today's local date", () => {
    expect(toIsoDate(undefined, today)).toBe("2026-10-06");
    expect(toIsoDate("Oct 1", today)).toBe("2026-10-06");
  });
});
