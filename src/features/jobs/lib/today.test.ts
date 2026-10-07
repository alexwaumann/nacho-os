import { describe, expect, it } from "vitest";

import { formatDriveTime, getStreet, isRouteDone, isStopDone, restoreStop } from "./today";

type Status = "pending" | "completed" | "paid";
const stop = (status: Status = "pending") => ({ status });

describe("isStopDone", () => {
  it("treats completed and paid stops as done", () => {
    expect(isStopDone(stop("completed"))).toBe(true);
    expect(isStopDone(stop("paid"))).toBe(true);
    expect(isStopDone(stop())).toBe(false);
  });
});

describe("isRouteDone", () => {
  it("is done when every stop is done", () => {
    expect(isRouteDone([stop("completed"), stop("paid")])).toBe(true);
    expect(isRouteDone([stop("completed"), stop()])).toBe(false);
  });

  it("is not done when there are no stops", () => {
    expect(isRouteDone([])).toBe(false);
  });
});

describe("restoreStop", () => {
  it("puts the stop back where it was", () => {
    expect(restoreStop(["a", "c", "d"], "b", 1)).toEqual(["a", "b", "c", "d"]);
    expect(restoreStop(["b", "c"], "a", 0)).toEqual(["a", "b", "c"]);
  });

  it("puts it at the end when the route got shorter", () => {
    expect(restoreStop(["a"], "d", 3)).toEqual(["a", "d"]);
  });

  it("doesn't add the stop twice", () => {
    expect(restoreStop(["a", "b", "c"], "b", 0)).toEqual(["b", "a", "c"]);
  });
});

describe("getStreet", () => {
  it("keeps the part before the first comma", () => {
    expect(getStreet("123 Main St, Springfield, IL 62701")).toBe("123 Main St");
  });

  it("returns the whole address without a comma", () => {
    expect(getStreet("  45 Oak Ave ")).toBe("45 Oak Ave");
  });
});

describe("formatDriveTime", () => {
  it("says minutes under an hour", () => {
    expect(formatDriveTime(45 * 60)).toBe("45 min drive");
    expect(formatDriveTime(10)).toBe("1 min drive");
  });

  it("says hours and minutes for long drives", () => {
    expect(formatDriveTime(3600)).toBe("1 hr drive");
    expect(formatDriveTime(80 * 60 + 20)).toBe("1 hr 20 min drive");
  });

  it("returns null when the drive time is unknown", () => {
    expect(formatDriveTime(undefined)).toBeNull();
  });
});
