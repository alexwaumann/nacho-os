import { describe, expect, it } from "vitest";

import {
  calculateDistance,
  formatDistance,
  formatDuration,
  parseDuration,
  resolveWaypointOrder,
  toRouteMetrics,
} from "./routing";

describe("formatDistance", () => {
  it("formats meters as miles to one decimal", () => {
    expect(formatDistance(0)).toBe("0 mi");
    expect(formatDistance(800)).toBe("0.5 mi");
    expect(formatDistance(16093.4)).toBe("10 mi");
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration("0s")).toBe("0 sec");
    expect(formatDuration("45s")).toBe("45 sec");
    expect(formatDuration("90s")).toBe("2 min");
    expect(formatDuration("3600s")).toBe("1h 0min");
    expect(formatDuration("5430s")).toBe("1h 31min");
  });
});

describe("parseDuration", () => {
  it("reads Google's seconds string", () => {
    expect(parseDuration("123s")).toBe(123);
  });
});

describe("toRouteMetrics", () => {
  it("formats a leg for the screen and keeps the raw values", () => {
    expect(toRouteMetrics({ distanceMeters: 1609.34, duration: "600s" })).toEqual({
      distance: "1 mi",
      duration: "10 min",
      distanceValue: 1609.34,
      durationValue: 600,
    });
  });

  it("treats fields Google omitted as zero", () => {
    expect(toRouteMetrics({})).toEqual({
      distance: "0 mi",
      duration: "0 sec",
      distanceValue: 0,
      durationValue: 0,
    });
  });
});

describe("resolveWaypointOrder", () => {
  it("uses Google's order when it's a full permutation", () => {
    expect(resolveWaypointOrder(3, [2, 0, 1])).toEqual([2, 0, 1]);
  });

  it("falls back to the given order when nothing was reordered", () => {
    expect(resolveWaypointOrder(1, [-1])).toEqual([0]);
    expect(resolveWaypointOrder(2, undefined)).toEqual([0, 1]);
  });

  it("falls back when the order isn't a permutation", () => {
    expect(resolveWaypointOrder(3, [0, 0, 1])).toEqual([0, 1, 2]);
    expect(resolveWaypointOrder(3, [1, 0])).toEqual([0, 1, 2]);
  });
});

describe("calculateDistance", () => {
  it("is zero for the same point", () => {
    expect(calculateDistance({ lat: 30, lng: -97 }, { lat: 30, lng: -97 })).toBe(0);
  });

  it("measures great-circle distance in km", () => {
    // Austin to Waco is roughly 150 km as the crow flies
    const km = calculateDistance({ lat: 30.2672, lng: -97.7431 }, { lat: 31.5493, lng: -97.1467 });
    expect(km).toBeGreaterThan(145);
    expect(km).toBeLessThan(160);
  });
});
