import { describe, expect, it } from "vitest";
import * as z from "zod";

import { jobSheetTabSchema } from "./jobSheetTab";

describe("jobSheetTabSchema", () => {
  const search = z.object({ tab: jobSheetTabSchema });

  it("keeps the current tab names", () => {
    expect(search.parse({ tab: "tasks" }).tab).toBe("tasks");
    expect(search.parse({ tab: "info" }).tab).toBe("info");
    expect(search.parse({ tab: "money" }).tab).toBe("money");
    expect(search.parse({ tab: "photos" }).tab).toBe("photos");
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
