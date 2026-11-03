import { describe, expect, it } from "vitest";

import { getDefaultJobSheetTab } from "./jobSheetTab";

describe("getDefaultJobSheetTab", () => {
  it("opens a pending job on today's route to Tasks", () => {
    expect(getDefaultJobSheetTab({ status: "pending", selectedForRoute: true })).toBe("tasks");
  });

  it("opens a pending job not on the route to Info", () => {
    expect(getDefaultJobSheetTab({ status: "pending", selectedForRoute: false })).toBe("info");
  });

  it("opens a completed, unpaid job to Money whether or not it's on the route", () => {
    expect(getDefaultJobSheetTab({ status: "completed", selectedForRoute: false })).toBe("money");
    expect(getDefaultJobSheetTab({ status: "completed", selectedForRoute: true })).toBe("money");
  });

  it("opens a paid job to Info", () => {
    expect(getDefaultJobSheetTab({ status: "paid", selectedForRoute: false })).toBe("info");
    expect(getDefaultJobSheetTab({ status: "paid", selectedForRoute: true })).toBe("info");
  });
});
