import { describe, expect, it } from "vitest";

import { buildRouteBriefContext, routeMiles, sanitizeRouteBrief } from "./routeBriefAgent";
import type { RouteBriefAgentInput, RouteBriefResponse } from "./routeBriefAgent";

const response = (overrides: Partial<RouteBriefResponse> = {}): RouteBriefResponse => ({
  headline: " Rain moves into Lufkin around 2 PM. ",
  severity: "act",
  siteNotes: [],
  suggestion: null,
  ...overrides,
});

// Home, then three stops in a line: 10, 20, 30 miles out
const miles: RouteBriefAgentInput["miles"] = {
  fromHome: [10, 20, 30],
  between: [
    [0, 10, 20],
    [10, 0, 10],
    [20, 10, 0],
  ],
};

describe("sanitizeRouteBrief", () => {
  it("trims the headline and keeps the severity", () => {
    expect(sanitizeRouteBrief(response(), 3)).toEqual({
      headline: "Rain moves into Lufkin around 2 PM.",
      severity: "act",
      siteNotes: [],
      suggestion: null,
    });
  });

  it("rejects an empty headline", () => {
    expect(() => sanitizeRouteBrief(response({ headline: "  " }), 3)).toThrow();
  });

  it("drops notes for unknown stops, blank notes and repeats", () => {
    const { siteNotes } = sanitizeRouteBrief(
      response({
        siteNotes: [
          { stopIndex: 1, note: "Rain by 2 PM. " },
          { stopIndex: 1, note: "Again" },
          { stopIndex: 5, note: "No such stop" },
          { stopIndex: 0.5, note: "Not a stop" },
          { stopIndex: 2, note: " " },
        ],
      }),
      3,
    );
    expect(siteNotes).toEqual([{ stopIndex: 1, note: "Rain by 2 PM." }]);
  });

  it("keeps a suggestion that visits every stop once in a new order", () => {
    const suggestion = { order: [1, 0, 2], reason: "Paint first, before the rain." };
    expect(sanitizeRouteBrief(response({ suggestion }), 3, miles).suggestion).toEqual(suggestion);
  });

  it("drops suggestions that skip, repeat or don't change anything", () => {
    for (const order of [
      [1, 0],
      [1, 1, 2],
      [0, 1, 3],
      [0, 1, 2],
    ]) {
      const brief = sanitizeRouteBrief(response({ suggestion: { order, reason: "Why" } }), 3);
      expect(brief.suggestion).toBeNull();
    }
  });

  it("drops a suggestion without a reason, or for a single stop", () => {
    expect(
      sanitizeRouteBrief(response({ suggestion: { order: [1, 0], reason: " " } }), 2).suggestion,
    ).toBeNull();
    expect(
      sanitizeRouteBrief(response({ suggestion: { order: [0], reason: "Why" } }), 1).suggestion,
    ).toBeNull();
  });

  it("drops a suggestion that adds too much driving", () => {
    const far: RouteBriefAgentInput["miles"] = {
      fromHome: [10, 100, 110],
      between: [
        [0, 90, 100],
        [90, 0, 10],
        [100, 10, 0],
      ],
    };
    // 10 + 90 + 10 + 110 = 220 now; 100 + 90 + 100 + 110 = 400 suggested
    const suggestion = { order: [1, 0, 2], reason: "Why" };
    expect(sanitizeRouteBrief(response({ suggestion }), 3, far).suggestion).toBeNull();
  });
});

describe("routeMiles", () => {
  it("adds the legs, out from home and back", () => {
    expect(routeMiles([0, 1, 2], miles)).toBe(10 + 10 + 10 + 30);
    expect(routeMiles([2, 0, 1], miles)).toBe(30 + 20 + 10 + 20);
  });

  it("is unknown when a distance is missing", () => {
    expect(
      routeMiles([0, 1], {
        fromHome: null,
        between: [
          [0, null],
          [null, 0],
        ],
      }),
    ).toBeNull();
  });
});

describe("buildRouteBriefContext", () => {
  it("formats times in the user's time zone and leaves out past hours", () => {
    const hour = (h: number) => Date.UTC(2026, 9, 6, h + 5); // America/Chicago is UTC-5 in October
    const slot = (h: number, precipProb: number) => ({
      time: hour(h),
      temp: 70,
      precipProb,
      code: precipProb > 50 ? 61 : 3,
      condition: precipProb > 50 ? "Rainy" : "Cloudy",
      isDay: true,
      windMph: 5,
      gustMph: 25,
    });

    const context = buildRouteBriefContext({
      today: "Tuesday, October 6, 2026 at 8:20 AM",
      timeZone: "America/Chicago",
      startTime: hour(9),
      hasHome: true,
      stops: [
        {
          address: "12 Oak St, Lufkin, TX",
          legSeconds: 100 * 60,
          arrivalTime: hour(10) + 40 * 60 * 1000,
          pendingTasks: [{ taskName: "Paint trim", category: "Painting", area: "Porch" }],
          weatherRisk: { hasRisk: true, reason: "Rain later" },
          forecast: [slot(6, 0), slot(7, 0), slot(14, 80)],
        },
      ],
      miles: { fromHome: [40], between: [[0]] },
    });

    expect(context.leavesAround).toBe("9:00 AM");
    expect(context.stops[0]).toMatchObject({
      stopIndex: 0,
      driveFromPrevious: "1 hr 40 min",
      arriveAround: "10:40 AM",
      leaveAround: "12:10 PM",
      earlierWeatherWarning: "Rain later",
      hourlyForecast: ["2 PM: 70°F Rainy, rain chance 80%, wind 5 mph, gusts 25 mph"],
    });
  });
});
