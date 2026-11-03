import { describe, expect, it } from "vitest";

import {
  formatDueDate,
  getJobProgressStatus,
  getTaskProgress,
  getVisibleJobs,
  isNewJob,
  matchesAddressSearch,
} from "./jobsList";

const task = (completed: boolean, requiresOnlineOrder = false) => ({
  completed,
  requiresOnlineOrder,
});

describe("matchesAddressSearch", () => {
  it("matches any part of the address, ignoring case", () => {
    expect(matchesAddressSearch("123 Main St, Waco", "main")).toBe(true);
    expect(matchesAddressSearch("123 Main St, Waco", "WACO")).toBe(true);
    expect(matchesAddressSearch("123 Main St, Waco", "elm")).toBe(false);
  });

  it("matches everything when the search is empty or just spaces", () => {
    expect(matchesAddressSearch("123 Main St", "")).toBe(true);
    expect(matchesAddressSearch("123 Main St", "   ")).toBe(true);
  });

  it("ignores spaces around the search", () => {
    expect(matchesAddressSearch("123 Main St", "  main ")).toBe(true);
  });
});

describe("getVisibleJobs", () => {
  const jobs = [
    { address: "1 Elm St", dueDate: undefined },
    { address: "2 Oak St", dueDate: "2026-11-10" },
    { address: "3 Elm Ave", dueDate: "2026-11-01" },
  ];

  it("sorts pending jobs by due date, soonest first", () => {
    expect(getVisibleJobs(jobs, "pending", "").map((job) => job.address)).toEqual([
      "3 Elm Ave",
      "2 Oak St",
      "1 Elm St",
    ]);
  });

  it("keeps the server order for completed and paid jobs", () => {
    expect(getVisibleJobs(jobs, "completed", "").map((job) => job.address)).toEqual([
      "1 Elm St",
      "2 Oak St",
      "3 Elm Ave",
    ]);
    expect(getVisibleJobs(jobs, "paid", "")).toEqual(jobs);
  });

  it("filters by the address search before sorting", () => {
    expect(getVisibleJobs(jobs, "pending", "elm").map((job) => job.address)).toEqual([
      "3 Elm Ave",
      "1 Elm St",
    ]);
  });

  it("does not change the input", () => {
    const input = [...jobs];
    getVisibleJobs(input, "pending", "");
    expect(input).toEqual(jobs);
  });
});

describe("getTaskProgress", () => {
  it("counts done and total tasks", () => {
    expect(getTaskProgress({ tasks: [task(true), task(false), task(true)] })).toEqual({
      done: 2,
      total: 3,
    });
  });

  it("is 0 of 0 without tasks", () => {
    expect(getTaskProgress({})).toEqual({ done: 0, total: 0 });
  });
});

describe("getJobProgressStatus", () => {
  it("shows paid and completed jobs as such, whatever their tasks", () => {
    expect(getJobProgressStatus({ status: "paid", tasks: [task(false, true)] })).toBe("paid");
    expect(getJobProgressStatus({ status: "completed", tasks: [task(false, true)] })).toBe(
      "completed",
    );
  });

  it("shows parts needed while an online-order task is open", () => {
    expect(
      getJobProgressStatus({ status: "pending", tasks: [task(true), task(false, true)] }),
    ).toBe("parts-needed");
  });

  it("does not show parts needed once the ordered task is done", () => {
    expect(
      getJobProgressStatus({ status: "pending", tasks: [task(true, true), task(false)] }),
    ).toBe("in-progress");
  });

  it("shows in progress when some but not all tasks are done", () => {
    expect(getJobProgressStatus({ status: "pending", tasks: [task(true), task(false)] })).toBe(
      "in-progress",
    );
  });

  it("shows pending with no tasks done, all tasks done, or no tasks", () => {
    expect(getJobProgressStatus({ status: "pending", tasks: [task(false)] })).toBe("pending");
    expect(getJobProgressStatus({ status: "pending", tasks: [task(true)] })).toBe("pending");
    expect(getJobProgressStatus({ status: "pending" })).toBe("pending");
  });
});

describe("isNewJob", () => {
  const now = Date.UTC(2026, 10, 3, 12);

  it("is new for the first 24 hours", () => {
    expect(isNewJob(now - 23 * 60 * 60 * 1000, now)).toBe(true);
    expect(isNewJob(now - 25 * 60 * 60 * 1000, now)).toBe(false);
  });
});

describe("formatDueDate", () => {
  it("formats an ISO date in the local calendar", () => {
    expect(formatDueDate("2026-11-03", "en-US")).toBe("Nov 3, 2026");
  });

  it("returns free-text dates as typed", () => {
    expect(formatDueDate("next Friday", "en-US")).toBe("next Friday");
  });
});
