import { describe, expect, it } from "vitest";
import * as z from "zod";

import { getDefaultJobSheetTab, jobSheetTabSchema } from "./jobSheetTab";

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

describe("jobSheetTabSchema", () => {
  const search = z.object({ tab: jobSheetTabSchema });

  it("keeps the current tab names", () => {
    expect(search.parse({ tab: "tasks" }).tab).toBe("tasks");
    expect(search.parse({ tab: "info" }).tab).toBe("info");
    expect(search.parse({ tab: "money" }).tab).toBe("money");
  });

  it("maps the old details tab to Info", () => {
    expect(search.parse({ tab: "details" }).tab).toBe("info");
  });

  it("leaves the tab unset when missing or unknown so the default applies", () => {
    expect(search.parse({}).tab).toBeUndefined();
    expect(search.parse({ tab: "receipts" }).tab).toBeUndefined();
    expect(search.parse({ tab: 3 }).tab).toBeUndefined();
  });
});
