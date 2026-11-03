import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_BASE64_LENGTH,
  MAX_IMAGE_BYTES,
  assertImage,
  assertImageOrPdf,
  isPdf,
} from "./media";

const big = "A".repeat(MAX_IMAGE_BASE64_LENGTH + 1);

describe("isPdf", () => {
  it("matches the PDF mime type, ignoring case and parameters", () => {
    expect(isPdf("application/pdf")).toBe(true);
    expect(isPdf("Application/PDF; charset=binary")).toBe(true);
    expect(isPdf("image/jpeg")).toBe(false);
    expect(isPdf(undefined)).toBe(false);
    expect(isPdf(null)).toBe(false);
  });
});

describe("assertImageOrPdf", () => {
  it("accepts images and PDFs", () => {
    expect(() => assertImageOrPdf({ base64: "abc", mimeType: "image/jpeg" })).not.toThrow();
    expect(() => assertImageOrPdf({ base64: "abc", mimeType: "application/pdf" })).not.toThrow();
  });

  it("refuses other files, like assertImage", () => {
    expect(() => assertImageOrPdf({ base64: "abc", mimeType: "text/plain" })).toThrow(
      "Expected an image",
    );
  });

  it("refuses ones too large for the action, with a message for each kind", () => {
    expect(() => assertImageOrPdf({ base64: big, mimeType: "image/png" })).toThrow(ConvexError);
    expect(() => assertImageOrPdf({ base64: big, mimeType: "application/pdf" })).toThrow(
      /PDF is too large/,
    );
  });
});

describe("assertImage", () => {
  it("still refuses PDFs", () => {
    expect(() => assertImage({ base64: "abc", mimeType: "application/pdf" })).toThrow(
      "Expected an image",
    );
  });
});

describe("MAX_IMAGE_BYTES", () => {
  it("is the file size whose base64 fits the action limit", () => {
    expect(Math.ceil(MAX_IMAGE_BYTES / 3) * 4).toBeLessThanOrEqual(MAX_IMAGE_BASE64_LENGTH);
  });
});
