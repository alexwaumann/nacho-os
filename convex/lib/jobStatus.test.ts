import { describe, expect, it } from "vitest";

import { getStatusDates } from "./jobStatus";

const none = { completedOn: undefined, paidOn: undefined };

describe("getStatusDates", () => {
  it("records the day a step is first reached", () => {
    expect(getStatusDates(none, "completed", "2026-11-08")).toEqual({
      completedOn: "2026-11-08",
      paidOn: undefined,
    });
    expect(getStatusDates(none, "paid", "2026-11-08")).toEqual({
      completedOn: "2026-11-08",
      paidOn: "2026-11-08",
    });
  });

  it("keeps the finish date when it gets paid later", () => {
    const done = { completedOn: "2026-10-01", paidOn: undefined };
    expect(getStatusDates(done, "paid", "2026-11-08")).toEqual({
      completedOn: "2026-10-01",
      paidOn: "2026-11-08",
    });
  });

  it("clears the dates of undone steps", () => {
    const paid = { completedOn: "2026-10-01", paidOn: "2026-10-05" };
    expect(getStatusDates(paid, "completed", "2026-11-08")).toEqual({
      completedOn: "2026-10-01",
      paidOn: undefined,
    });
    expect(getStatusDates(paid, "pending", "2026-11-08")).toEqual(none);
  });

  it("uses the new day after a mistaken Done is undone", () => {
    const undone = getStatusDates(
      getStatusDates(none, "completed", "2026-11-08"),
      "pending",
      "2026-11-08",
    );
    expect(getStatusDates(undone, "completed", "2026-11-15").completedOn).toBe("2026-11-15");
  });
});
