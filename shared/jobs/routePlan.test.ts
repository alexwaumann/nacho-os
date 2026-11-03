import { describe, expect, it } from "vitest";

import {
  buildRouteLegUpdates,
  buildRouteSelections,
  describeGeocodeFailure,
  getDeselectedIds,
  hasOrderChanged,
  moveInOrder,
  sumRouteLegs,
} from "./routePlan";

const leg = (minutes: number, miles: number) => ({
  duration: `${minutes} mins`,
  distance: `${miles} mi`,
  durationValue: minutes * 60,
  distanceValue: miles * 1609,
});

describe("buildRouteSelections", () => {
  it("numbers the route in order and drops the deselected jobs", () => {
    expect(buildRouteSelections(["b", "a"], ["c"])).toEqual([
      { jobId: "b", selected: true, routeOrder: 0 },
      { jobId: "a", selected: true, routeOrder: 1 },
      { jobId: "c", selected: false, routeOrder: undefined },
    ]);
  });

  it("works with nothing deselected", () => {
    expect(buildRouteSelections(["a"])).toEqual([{ jobId: "a", selected: true, routeOrder: 0 }]);
  });
});

describe("buildRouteLegUpdates", () => {
  it("gives each stop the leg that drives to it and ignores the drive home", () => {
    const updates = buildRouteLegUpdates(["a", "b"], [leg(10, 3), leg(20, 8), leg(30, 12)]);
    expect(updates).toEqual([
      {
        jobId: "a",
        routeOrder: 0,
        travelTime: "10 mins",
        distance: "3 mi",
        travelTimeValue: 600,
        distanceValue: 3 * 1609,
      },
      {
        jobId: "b",
        routeOrder: 1,
        travelTime: "20 mins",
        distance: "8 mi",
        travelTimeValue: 1200,
        distanceValue: 8 * 1609,
      },
    ]);
  });

  it("leaves the metrics empty when a leg is missing", () => {
    expect(buildRouteLegUpdates(["a"], [])[0]).toMatchObject({
      routeOrder: 0,
      travelTimeValue: undefined,
    });
  });
});

describe("sumRouteLegs", () => {
  it("adds up every leg", () => {
    expect(sumRouteLegs([leg(10, 1), leg(5, 2)])).toEqual({
      durationValue: 900,
      distanceValue: 3 * 1609,
    });
  });

  it("is zero without legs", () => {
    expect(sumRouteLegs([])).toEqual({ durationValue: 0, distanceValue: 0 });
  });
});

describe("getDeselectedIds", () => {
  it("returns the route jobs that weren't picked", () => {
    const jobs = [
      { _id: "a", selectedForRoute: true },
      { _id: "b", selectedForRoute: true },
      { _id: "c", selectedForRoute: false },
      { _id: "d" },
    ];
    expect(getDeselectedIds(jobs, ["b", "c"])).toEqual(["a"]);
  });
});

describe("describeGeocodeFailure", () => {
  it("names a single address", () => {
    expect(describeGeocodeFailure(["1 Main St"])).toBe(
      "Couldn't find 1 Main St on the map. Check the address on that job, then try again.",
    );
  });

  it("lists several addresses", () => {
    expect(describeGeocodeFailure(["1 Main St", "2 Oak Ave"])).toContain("1 Main St; 2 Oak Ave");
  });
});

describe("hasOrderChanged", () => {
  it("is false for the same order", () => {
    expect(hasOrderChanged(["a", "b"], ["a", "b"])).toBe(false);
  });

  it("is true when moved, added or removed", () => {
    expect(hasOrderChanged(["b", "a"], ["a", "b"])).toBe(true);
    expect(hasOrderChanged(["a"], ["a", "b"])).toBe(true);
    expect(hasOrderChanged(["a", "b", "c"], ["a", "b"])).toBe(true);
  });
});

describe("moveInOrder", () => {
  it("moves an item up or down", () => {
    expect(moveInOrder(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveInOrder(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("clamps the target and ignores a bad source", () => {
    expect(moveInOrder(["a", "b"], 0, 5)).toEqual(["b", "a"]);
    expect(moveInOrder(["a", "b"], 1, -3)).toEqual(["b", "a"]);
    expect(moveInOrder(["a", "b"], 4, 0)).toEqual(["a", "b"]);
  });

  it("doesn't change the input", () => {
    const order = ["a", "b"];
    moveInOrder(order, 0, 1);
    expect(order).toEqual(["a", "b"]);
  });
});
