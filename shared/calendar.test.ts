import { describe, expect, it } from "vitest";

import {
  addDays,
  formatIsoDate,
  getMonthGrid,
  parseIsoDate,
  shiftMonth,
  toIsoDay,
} from "./calendar";

describe("parseIsoDate", () => {
  it("reads a YYYY-MM-DD date as a local day", () => {
    const date = parseIsoDate("2026-11-03");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(3);
  });

  it("rejects free text, missing values and impossible days", () => {
    expect(parseIsoDate("next Tuesday")).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate("2026-02-31")).toBeNull();
  });
});

describe("toIsoDay / addDays", () => {
  it("formats the local day with zero padding", () => {
    expect(toIsoDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("adds days across month and year ends", () => {
    expect(addDays(new Date(2026, 11, 30), 3)).toBe("2027-01-02");
    expect(addDays(new Date(2026, 2, 1), -1)).toBe("2026-02-28");
  });
});

describe("formatIsoDate", () => {
  it("formats an ISO date for people", () => {
    expect(formatIsoDate("2026-11-03", "en-US")).toBe("Nov 3, 2026");
  });

  it("passes free text through", () => {
    expect(formatIsoDate("End of month", "en-US")).toBe("End of month");
  });
});

describe("getMonthGrid", () => {
  it("lays November 2026 out in Sunday-first weeks", () => {
    // Nov 1, 2026 is a Sunday; 30 days
    const weeks = getMonthGrid(2026, 10);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe("2026-11-01");
    expect(weeks[4]).toEqual(["2026-11-29", "2026-11-30", null, null, null, null, null]);
  });

  it("pads the days before the 1st", () => {
    // Oct 1, 2026 is a Thursday
    const weeks = getMonthGrid(2026, 9);
    expect(weeks[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});

describe("shiftMonth", () => {
  it("wraps around the year", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});
