import { describe, expect, it } from "vitest";

import { getHourStart, msUntilNextHour, roundCoordinate, selectForecastSlots } from "./forecast";
import type { HourlyForecast } from "../../convex/lib/weather";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Local times, so the tests pass in any time zone
const at = (hours: number, minutes = 0) => new Date(2026, 10, 3, hours, minutes).getTime();

const slot = (time: number, temp = 70) => ({
  time,
  temp,
  precipProb: 0,
  code: 0,
  condition: "Clear",
  isDay: true,
});

// Current reading at 8:20, then hourly slots from 8:00 to 23:00
const forecast: HourlyForecast = {
  current: slot(at(8, 20), 60),
  hourly: Array.from({ length: 16 }, (_, index) => slot(at(8 + index), 61 + index)),
};

describe("getHourStart", () => {
  it("drops the minutes", () => {
    expect(getHourStart(at(8, 42))).toBe(at(8));
  });
});

describe("msUntilNextHour", () => {
  it("counts to just after the next hour", () => {
    expect(msUntilNextHour(at(8, 45))).toBe(15 * MINUTE + 1000);
  });
});

describe("roundCoordinate", () => {
  it("keeps two decimals", () => {
    expect(roundCoordinate(31.54934)).toBe(31.55);
    expect(roundCoordinate(-97.1467)).toBe(-97.15);
  });
});

describe("selectForecastSlots", () => {
  const hourStart = at(8);

  it("shows now and the next hours after the current one", () => {
    const { slots, arrivalIndex } = selectForecastSlots(forecast, hourStart, 4);
    expect(slots.map((s) => s.time)).toEqual([at(8, 20), at(9), at(10), at(11), at(12)]);
    expect(arrivalIndex).toBe(-1);
  });

  it("highlights the hour nearest the arrival", () => {
    const { arrivalIndex } = selectForecastSlots(forecast, hourStart, 4, at(10, 10));
    expect(arrivalIndex).toBe(2);
  });

  it("swaps the last slot for a later arrival hour", () => {
    const { slots, arrivalIndex } = selectForecastSlots(forecast, hourStart, 4, at(15, 5));
    expect(slots[4].time).toBe(at(15));
    expect(arrivalIndex).toBe(4);
  });

  it("highlights nothing for an arrival past the forecast", () => {
    const { arrivalIndex } = selectForecastSlots(forecast, hourStart, 4, at(8) + 30 * HOUR);
    expect(arrivalIndex).toBe(-1);
  });
});
