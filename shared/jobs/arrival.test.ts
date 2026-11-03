import { describe, expect, it } from "vitest";

import {
  estimateArrivalTimes,
  estimateRouteArrivals,
  findNearestSlotIndex,
  getRouteStartTime,
} from "./arrival";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Local times, so the tests pass in any time zone
const at = (hours: number, minutes = 0, day = 6) =>
  new Date(2026, 9, day, hours, minutes).getTime();

describe("getRouteStartTime", () => {
  it("rounds up to the next full hour", () => {
    expect(getRouteStartTime(at(8, 20))).toBe(at(9));
    expect(getRouteStartTime(at(13, 59))).toBe(at(14));
  });

  it("moves on to the next hour when it's exactly on the hour", () => {
    expect(getRouteStartTime(at(9))).toBe(at(10));
  });

  it("doesn't start before 7 AM", () => {
    expect(getRouteStartTime(at(4, 30))).toBe(at(7));
    expect(getRouteStartTime(at(6, 5))).toBe(at(7));
  });

  it("gives the same start all hour long", () => {
    expect(getRouteStartTime(at(10))).toBe(getRouteStartTime(at(10, 45)));
  });
});

describe("estimateArrivalTimes", () => {
  it("adds each leg plus 90 minutes at every earlier stop", () => {
    const start = at(9);
    const arrivals = estimateArrivalTimes(start, [30 * 60, 2 * 60 * 60, 45 * 60]);

    expect(arrivals).toEqual([
      at(9, 30), // 30 min drive
      at(13), // 9:30 + 90 min on site + 2 hr drive
      at(15, 15), // 1:00 + 90 min on site + 45 min drive
    ]);
  });

  it("treats missing legs as no driving", () => {
    expect(estimateArrivalTimes(at(9), [undefined, undefined])).toEqual([at(9), at(10, 30)]);
  });

  it("takes a different time on site", () => {
    expect(estimateArrivalTimes(at(9), [0, 0], 60)).toEqual([at(9), at(10)]);
  });

  it("returns nothing for an empty route", () => {
    expect(estimateArrivalTimes(at(9), [])).toEqual([]);
  });
});

describe("estimateRouteArrivals", () => {
  it("starts from the next hour, or 7 AM", () => {
    expect(estimateRouteArrivals(at(8, 20), [60 * 60])).toEqual([at(10)]);
    expect(estimateRouteArrivals(at(5), [60 * 60])).toEqual([at(8)]);
  });
});

describe("findNearestSlotIndex", () => {
  const slots = [at(9), at(10), at(11), at(12)];

  it("finds the closest hour", () => {
    expect(findNearestSlotIndex(slots, at(10, 20))).toBe(1);
    expect(findNearestSlotIndex(slots, at(10, 40))).toBe(2);
    expect(findNearestSlotIndex(slots, at(12))).toBe(3);
  });

  it("picks the earlier hour on a tie", () => {
    expect(findNearestSlotIndex(slots, at(9, 30))).toBe(0);
  });

  it("returns -1 when the time is past the forecast", () => {
    expect(findNearestSlotIndex(slots, at(14))).toBe(-1);
    expect(findNearestSlotIndex(slots, at(12) + HOUR, 2 * HOUR)).toBe(3);
  });

  it("returns -1 without slots", () => {
    expect(findNearestSlotIndex([], at(9))).toBe(-1);
  });
});
