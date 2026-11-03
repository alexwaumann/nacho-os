import { describe, expect, it } from "vitest";

import { describeJobSource, describeQueueError, getAddJobRows, groupPages } from "./addJobQueue";
import type { Id } from "../../convex/_generated/dataModel";
import type { JobSubmission, NewJob, QueueItem } from "./addJobQueue";

const queueId = (id: string) => id as Id<"jobProcessingQueue">;
const storageId = (id: string) => id as Id<"_storage">;
const jobId = (id: string) => id as Id<"jobs">;

describe("describeJobSource", () => {
  it("names scans by page count", () => {
    expect(describeJobSource("scan", 1)).toBe("Scan");
    expect(describeJobSource("scan", 3)).toBe("Scan (3 pages)");
  });

  it("names photos by count", () => {
    expect(describeJobSource("camera", 1)).toBe("Photo");
    expect(describeJobSource("library", 1)).toBe("Photo");
    expect(describeJobSource("library", 2)).toBe("2 photos");
  });
});

describe("describeQueueError", () => {
  it("gives advice when no address was found", () => {
    expect(describeQueueError("Could not extract property address from the document.")).toBe(
      "Couldn't find the address on it. Try a clearer picture of the whole page.",
    );
  });

  it("keeps short server messages and hides raw ones", () => {
    expect(describeQueueError("No document found in storage")).toBe("No document found in storage");
    const fallback = "Couldn't read this one. Try again, or use a clearer picture.";
    expect(describeQueueError(undefined)).toBe(fallback);
    expect(describeQueueError("  ")).toBe(fallback);
    expect(describeQueueError('[GoogleGenerativeAI Error]: 500 {"error":"x"}')).toBe(fallback);
    expect(describeQueueError("x".repeat(200))).toBe(fallback);
  });
});

describe("groupPages", () => {
  it("puts every page in one job", () => {
    expect(groupPages(["a", "b", "c"], "one")).toEqual([["a", "b", "c"]]);
  });

  it("makes a job per page", () => {
    expect(groupPages(["a", "b"], "each")).toEqual([["a"], ["b"]]);
  });

  it("makes no jobs from no pages", () => {
    expect(groupPages([], "one")).toEqual([]);
    expect(groupPages([], "each")).toEqual([]);
  });
});

describe("getAddJobRows", () => {
  const sent = (id: string, q: string, pages: Array<string>): JobSubmission => ({
    id,
    name: `Scan ${id}`,
    stage: "sent",
    queueId: queueId(q),
    storageIds: pages.map(storageId),
  });

  it("shows uploads and upload failures from this phone", () => {
    const rows = getAddJobRows(
      [
        { id: "a", name: "Photo", stage: "uploading" },
        { id: "b", name: "Scan", stage: "uploadFailed", error: "No internet" },
      ],
      [],
      [],
    );
    expect(rows).toEqual([
      { key: "a", name: "Photo", submissionId: "a", kind: "uploading" },
      { key: "b", name: "Scan", submissionId: "b", kind: "failed", error: "No internet" },
    ]);
  });

  it("follows a sent submission's queue item", () => {
    const queue: Array<QueueItem> = [
      { _id: queueId("q1"), fileName: "Scan a", status: "processing" },
      { _id: queueId("q2"), fileName: "Scan b", status: "failed", error: "No address found" },
    ];
    const rows = getAddJobRows([sent("a", "q1", ["s1"]), sent("b", "q2", ["s2"])], queue, []);
    expect(rows.map((r) => r.kind)).toEqual(["processing", "failed"]);
    expect(rows[1]).toMatchObject({ submissionId: "b", queueId: "q2", error: "No address found" });
  });

  it("explains the server's errors in plain words", () => {
    const queue: Array<QueueItem> = [
      {
        _id: queueId("q1"),
        fileName: "Scan a",
        status: "failed",
        error: "Could not extract property address from the document.",
      },
    ];
    const [row] = getAddJobRows([sent("a", "q1", ["s1"])], queue, []);
    expect(row).toMatchObject({ kind: "failed", error: describeQueueError(queue[0].error) });
  });

  it("is done when the queue item is gone and the job made from its pages exists", () => {
    const jobs: Array<NewJob> = [
      { _id: jobId("j0"), address: "1 Other St", sourceImageIds: [storageId("x")] },
      { _id: jobId("j1"), address: "123 Claude Test Ln", sourceImageIds: [storageId("s1")] },
    ];
    const rows = getAddJobRows([sent("a", "q1", ["s1", "s2"])], [], jobs);
    expect(rows).toEqual([
      {
        key: "a",
        name: "Scan a",
        submissionId: "a",
        kind: "done",
        jobId: "j1",
        address: "123 Claude Test Ln",
      },
    ]);
  });

  it("is done when the job made from its PDF exists (kept as the job's source file)", () => {
    const jobs: Array<NewJob> = [
      { _id: jobId("j0"), address: "1 Other St", sourceImageIds: [storageId("x")] },
      {
        _id: jobId("j1"),
        address: "123 Claude Test Ln",
        sourceImageIds: [],
        sourceFileId: storageId("pdf"),
      },
    ];
    const [row] = getAddJobRows([sent("a", "q1", ["pdf"])], [], jobs);
    expect(row).toMatchObject({ kind: "done", jobId: "j1", address: "123 Claude Test Ln" });
  });

  it("keeps processing until the new job shows up, or while the queue loads", () => {
    expect(getAddJobRows([sent("a", "q1", ["s1"])], [], [])[0].kind).toBe("processing");
    const jobs: Array<NewJob> = [
      { _id: jobId("j1"), address: "1 Main", sourceImageIds: [storageId("s1")] },
    ];
    expect(getAddJobRows([sent("a", "q1", ["s1"])], undefined, jobs)[0].kind).toBe("processing");
    expect(getAddJobRows([sent("a", "q1", ["s1"])], [], undefined)[0].kind).toBe("processing");
  });

  it("adds the rest of the server's queue after this phone's, without retry", () => {
    const queue: Array<QueueItem> = [
      { _id: queueId("q1"), fileName: "Scan a", status: "queued" },
      { _id: queueId("q9"), fileName: "order.pdf", status: "failed" },
      { _id: queueId("q8"), fileName: "photo.jpg", status: "processing" },
    ];
    const rows = getAddJobRows([sent("a", "q1", ["s1"])], queue, []);
    expect(rows).toEqual([
      { key: "a", name: "Scan a", submissionId: "a", queueId: "q1", kind: "processing" },
      {
        key: "q9",
        name: "order.pdf",
        queueId: "q9",
        kind: "failed",
        error: "Couldn't read this one. Try again, or use a clearer picture.",
      },
      { key: "q8", name: "photo.jpg", queueId: "q8", kind: "processing" },
    ]);
  });
});
