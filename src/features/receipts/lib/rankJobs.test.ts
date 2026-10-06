import { describe, expect, it } from "vitest";

import { getDefaultReceiptJobId, rankJobsForReceipt } from "./rankJobs";
import type { Doc } from "../../../../convex/_generated/dataModel";

const makeJob = (id: string, createdAt: number, extra: Partial<Doc<"jobs">> = {}): Doc<"jobs"> =>
  ({
    _id: id,
    _creationTime: createdAt,
    address: `${id} Main St`,
    type: "stop",
    status: "pending",
    selectedForRoute: false,
    ...extra,
  }) as unknown as Doc<"jobs">;

const ids = (jobs: Array<Doc<"jobs">>) => jobs.map((job) => job._id);

describe("rankJobsForReceipt", () => {
  it("puts route jobs first, in route order", () => {
    const jobs = [
      makeJob("old-other", 1),
      makeJob("route-3", 2, { selectedForRoute: true, routeOrder: 2 }),
      makeJob("route-1", 3, { selectedForRoute: true, routeOrder: 0 }),
      makeJob("new-other", 4),
      makeJob("route-2", 5, { selectedForRoute: true, routeOrder: 1 }),
    ];

    const { routeJobs, otherJobs } = rankJobsForReceipt(jobs);

    expect(ids(routeJobs)).toEqual(["route-1", "route-2", "route-3"]);
    expect(ids(otherJobs)).toEqual(["new-other", "old-other"]);
  });

  it("sorts the other jobs newest first and leaves out paid ones", () => {
    const jobs = [
      makeJob("a", 10),
      makeJob("paid", 40, { status: "paid" }),
      makeJob("c", 30, { status: "completed" }),
      makeJob("b", 20),
    ];

    const { routeJobs, otherJobs } = rankJobsForReceipt(jobs);

    expect(routeJobs).toEqual([]);
    expect(ids(otherJobs)).toEqual(["c", "b", "a"]);
  });

  it("puts route jobs without a route order after ordered ones, newest first", () => {
    const jobs = [
      makeJob("unordered-old", 1, { selectedForRoute: true }),
      makeJob("ordered", 2, { selectedForRoute: true, routeOrder: 0 }),
      makeJob("unordered-new", 3, { selectedForRoute: true }),
    ];

    expect(ids(rankJobsForReceipt(jobs).routeJobs)).toEqual([
      "ordered",
      "unordered-new",
      "unordered-old",
    ]);
  });

  it("does not change the input array", () => {
    const jobs = [makeJob("a", 1), makeJob("b", 2)];
    rankJobsForReceipt(jobs);
    expect(ids(jobs)).toEqual(["a", "b"]);
  });
});

describe("getDefaultReceiptJobId", () => {
  it("picks the route job when exactly one job is on the route", () => {
    const ranked = rankJobsForReceipt([
      makeJob("other", 1),
      makeJob("today", 2, { selectedForRoute: true, routeOrder: 0 }),
    ]);
    expect(getDefaultReceiptJobId(ranked)).toBe("today");
  });

  it("picks nothing when there are zero or several route jobs", () => {
    expect(getDefaultReceiptJobId(rankJobsForReceipt([makeJob("other", 1)]))).toBeNull();
    expect(
      getDefaultReceiptJobId(
        rankJobsForReceipt([
          makeJob("a", 1, { selectedForRoute: true, routeOrder: 0 }),
          makeJob("b", 2, { selectedForRoute: true, routeOrder: 1 }),
        ]),
      ),
    ).toBeNull();
  });
});
