import { describe, expect, it } from "vitest";

import {
  formatDriveTime,
  formatTasksLeft,
  mergeRestOrder,
  pickNextStop,
  splitRoute,
} from "./today";

type Status = "pending" | "completed" | "paid";
const stop = (id: string, status: Status = "pending") => ({ _id: id, status });

describe("pickNextStop", () => {
  it("picks the first pending stop in route order", () => {
    const jobs = [stop("a", "completed"), stop("b"), stop("c")];
    expect(pickNextStop(jobs)?._id).toBe("b");
  });

  it("treats paid stops as done", () => {
    expect(pickNextStop([stop("a", "paid"), stop("b")])?._id).toBe("b");
  });

  it("returns null when nothing is pending or the route is empty", () => {
    expect(pickNextStop([stop("a", "completed"), stop("b", "paid")])).toBeNull();
    expect(pickNextStop([])).toBeNull();
  });
});

describe("splitRoute", () => {
  it("splits off the next stop and keeps the rest in order", () => {
    const jobs = [stop("a", "completed"), stop("b"), stop("c")];
    const { next, rest, allDone } = splitRoute(jobs);
    expect(next?._id).toBe("b");
    expect(rest.map((job) => job._id)).toEqual(["a", "c"]);
    expect(allDone).toBe(false);
  });

  it("marks the route all done when every stop is done", () => {
    const jobs = [stop("a", "completed"), stop("b", "paid")];
    expect(splitRoute(jobs)).toEqual({ next: null, rest: jobs, allDone: true });
  });

  it("is not all done when there are no stops", () => {
    expect(splitRoute([])).toEqual({ next: null, rest: [], allDone: false });
  });
});

describe("mergeRestOrder", () => {
  it("keeps the next stop at its place in the route", () => {
    expect(mergeRestOrder(["a", "b", "c", "d"], "b", ["d", "a", "c"])).toEqual([
      "d",
      "b",
      "a",
      "c",
    ]);
  });

  it("returns the rest as is without a next stop", () => {
    expect(mergeRestOrder(["a", "b"], null, ["b", "a"])).toEqual(["b", "a"]);
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

describe("formatTasksLeft", () => {
  it("counts the tasks still to do", () => {
    const tasks = [{ completed: true }, { completed: false }, { completed: false }];
    expect(formatTasksLeft(tasks)).toBe("2 of 3 tasks left");
    expect(formatTasksLeft([{ completed: false }])).toBe("1 of 1 task left");
  });

  it("says when every task is done, and nothing without tasks", () => {
    expect(formatTasksLeft([{ completed: true }])).toBe("All tasks done");
    expect(formatTasksLeft([])).toBeNull();
    expect(formatTasksLeft(undefined)).toBeNull();
  });
});
