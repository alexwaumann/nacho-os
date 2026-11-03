import { describe, expect, it } from "vitest";

import { buildJobPins, getFitPoints, getNextFitTarget, getPinKind, getPinZIndex } from "./mapPins";

type Status = "pending" | "completed" | "paid";

const job = (id: string, status: Status = "pending", hasCoordinates = true) => ({
  _id: id,
  status,
  coordinates: hasCoordinates ? { lat: Number(id.length), lng: id.charCodeAt(0) } : undefined,
});

describe("buildJobPins", () => {
  it("numbers route stops in route order, counting stops without coordinates", () => {
    const route = [job("a"), job("b", "pending", false), job("c")];
    const { routePins } = buildJobPins(route, []);
    expect(routePins.map((pin) => [pin.job._id, pin.routeNumber])).toEqual([
      ["a", 1],
      ["c", 3],
    ]);
  });

  it("shows a route stop that matches the filter only once, as its numbered pin", () => {
    const a = job("a");
    const { routePins, otherPins } = buildJobPins([a], [a, job("d")]);
    expect(routePins).toHaveLength(1);
    expect(otherPins.map((pin) => pin.job._id)).toEqual(["d"]);
    expect(otherPins[0].routeNumber).toBeUndefined();
  });

  it("leaves out jobs without coordinates", () => {
    const { otherPins } = buildJobPins([], [job("a", "pending", false), job("b")]);
    expect(otherPins.map((pin) => pin.job._id)).toEqual(["b"]);
  });
});

describe("getNextFitTarget", () => {
  it("starts with today's route, then switches between the route and every pin", () => {
    expect(getNextFitTarget(null, true)).toBe("route");
    expect(getNextFitTarget("route", true)).toBe("all");
    expect(getNextFitTarget("all", true)).toBe("route");
  });

  it("always frames every pin without a route", () => {
    expect(getNextFitTarget(null, false)).toBe("all");
    expect(getNextFitTarget("all", false)).toBe("all");
  });
});

describe("getFitPoints", () => {
  it("frames today's route for the route target", () => {
    const { routePins, otherPins } = buildJobPins([job("a")], [job("bb")]);
    expect(getFitPoints("route", routePins, otherPins)).toEqual([routePins[0].position]);
  });

  it("frames every pin for the all target", () => {
    const { routePins, otherPins } = buildJobPins([job("a")], [job("bb")]);
    expect(getFitPoints("all", routePins, otherPins)).toHaveLength(2);
  });

  it("frames every pin when the route has none", () => {
    const { routePins, otherPins } = buildJobPins([], [job("a"), job("bb")]);
    expect(getFitPoints("route", routePins, otherPins)).toHaveLength(2);
  });

  it("is empty with no pins", () => {
    expect(getFitPoints("all", [], [])).toEqual([]);
  });
});

describe("getPinKind", () => {
  it("uses the route style for numbered stops, whatever their status", () => {
    expect(getPinKind({ job: { status: "completed" }, routeNumber: 2 })).toBe("route");
  });

  it("uses the job status for other pins", () => {
    expect(getPinKind({ job: { status: "pending" } })).toBe("pending");
    expect(getPinKind({ job: { status: "completed" } })).toBe("completed");
    expect(getPinKind({ job: { status: "paid" } })).toBe("paid");
  });
});

describe("getPinZIndex", () => {
  it("draws route stops above other jobs, lower numbers on top", () => {
    expect(getPinZIndex({ routeNumber: 1 })).toBeGreaterThan(getPinZIndex({ routeNumber: 2 }));
    expect(getPinZIndex({ routeNumber: 50 })).toBeGreaterThan(getPinZIndex({}));
  });
});
