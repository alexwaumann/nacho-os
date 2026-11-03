import { describe, expect, it } from "vitest";

import {
  addAccessCode,
  applyStatusChange,
  formatMoney,
  formatTaskQuantity,
  getJobMoneySummary,
  getStatusActions,
  getTaskProgress,
  groupTasksByCategory,
  isLastOpenTask,
  restoreAccessCode,
  setTaskCompleted,
  splitAccessCode,
} from "./jobSheet";
import type { JobTask } from "./jobSheet";

function task(id: string, category: string, completed = false): JobTask {
  return { id, category, taskName: `Task ${id}`, requiresOnlineOrder: false, completed };
}

describe("groupTasksByCategory", () => {
  it("groups by category in first-seen order and counts what's done", () => {
    const groups = groupTasksByCategory([
      task("1", "Paint", true),
      task("2", "Plumbing"),
      task("3", "Paint"),
      task("4", "  "),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Paint", "Plumbing", "Other"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["1", "3"]);
    expect(groups[0].done).toBe(1);
    expect(groups[1].done).toBe(0);
  });

  it("returns nothing for a job without tasks", () => {
    expect(groupTasksByCategory(undefined)).toEqual([]);
  });
});

describe("getTaskProgress", () => {
  it("counts done tasks", () => {
    expect(getTaskProgress([task("1", "A", true), task("2", "A")])).toEqual({
      done: 1,
      total: 2,
      fraction: 0.5,
    });
    expect(getTaskProgress(undefined)).toEqual({ done: 0, total: 0, fraction: 0 });
  });
});

describe("isLastOpenTask", () => {
  const tasks = [task("1", "A", true), task("2", "A")];

  it("is true when the task is the only one left", () => {
    expect(isLastOpenTask(tasks, "2")).toBe(true);
  });

  it("is false when others are still open or the task is already done", () => {
    expect(isLastOpenTask([...tasks, task("3", "A")], "2")).toBe(false);
    expect(isLastOpenTask(tasks, "1")).toBe(false);
    expect(isLastOpenTask(tasks, "missing")).toBe(false);
  });
});

describe("setTaskCompleted", () => {
  it("changes only that task", () => {
    const result = setTaskCompleted([task("1", "A"), task("2", "A")], "2", true);
    expect(result?.map((t) => t.completed)).toEqual([false, true]);
  });
});

describe("formatTaskQuantity", () => {
  it("shows the quantity with its unit when there is one", () => {
    expect(formatTaskQuantity({ quantity: 2, unit: "gal" })).toBe("2 gal");
    expect(formatTaskQuantity({ quantity: 3 })).toBe("3");
    expect(formatTaskQuantity({ unit: "ea" })).toBeNull();
  });
});

describe("access codes", () => {
  it("splits a labeled code", () => {
    expect(splitAccessCode("Lockbox: 7731")).toEqual({ label: "Lockbox", value: "7731" });
    expect(splitAccessCode("Gate 1234")).toEqual({ label: null, value: "Gate 1234" });
  });

  it("adds trimmed codes and ignores blank ones", () => {
    expect(addAccessCode(["A"], "  B ")).toEqual(["A", "B"]);
    expect(addAccessCode(["A"], "   ")).toEqual(["A"]);
  });

  it("puts a removed code back in its place, clamped to the list", () => {
    expect(restoreAccessCode(["A", "C"], 1, "B")).toEqual(["A", "B", "C"]);
    expect(restoreAccessCode([], 3, "B")).toEqual(["B"]);
  });
});

describe("money", () => {
  it("formats dollars", () => {
    expect(formatMoney(84.1)).toBe("$84.10");
    expect(formatMoney(1234.5)).toBe("$1,234.50");
  });

  it("adds receipts and works out what's left after them", () => {
    expect(getJobMoneySummary([{ total: 0.1 }, { total: 0.2 }], { amount: 500 })).toEqual({
      spent: 0.3,
      receiptCount: 2,
      paid: 500,
      leftAfterReceipts: 499.7,
    });
  });

  it("has nothing left to show until a check is scanned", () => {
    expect(getJobMoneySummary(undefined, null)).toEqual({
      spent: 0,
      receiptCount: 0,
      paid: null,
      leftAfterReceipts: null,
    });
  });
});

describe("applyStatusChange", () => {
  it("records the day it was first completed or paid", () => {
    const job = { status: "pending" as const, completedOn: undefined, paidOn: undefined };
    expect(applyStatusChange(job, "completed", "2026-11-03")).toMatchObject({
      status: "completed",
      completedOn: "2026-11-03",
    });
    expect(applyStatusChange(job, "paid", "2026-11-03")).toMatchObject({ paidOn: "2026-11-03" });
  });

  it("keeps earlier dates", () => {
    const job = { status: "paid" as const, completedOn: "2026-10-01", paidOn: "2026-10-05" };
    expect(applyStatusChange(job, "completed", "2026-11-03")).toEqual({
      status: "completed",
      completedOn: "2026-10-01",
      paidOn: "2026-10-05",
    });
  });
});

describe("getStatusActions", () => {
  it("offers the next step and a way back", () => {
    expect(getStatusActions("pending")).toEqual(["completed"]);
    expect(getStatusActions("completed")).toEqual(["paid", "pending"]);
    expect(getStatusActions("paid")).toEqual(["pending"]);
  });
});
