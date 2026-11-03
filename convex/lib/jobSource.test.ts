import { describe, expect, it } from "vitest";

import { getKeptSourceFileId } from "./jobSource";
import type { Id } from "../_generated/dataModel";

const pdf = "pdf" as Id<"_storage">;
const page = "page" as Id<"_storage">;

describe("getKeptSourceFileId", () => {
  it("keeps the original when there are no page images (a PDF from the iOS app)", () => {
    expect(getKeptSourceFileId(pdf, [])).toBe(pdf);
  });

  it("drops the original when the page images stand in for it (the website)", () => {
    expect(getKeptSourceFileId(pdf, [page])).toBeUndefined();
  });

  it("has nothing to keep without an original", () => {
    expect(getKeptSourceFileId(undefined, [])).toBeUndefined();
    expect(getKeptSourceFileId(undefined, [page])).toBeUndefined();
  });
});
