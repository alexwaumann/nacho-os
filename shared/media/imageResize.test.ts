import { describe, expect, it } from "vitest";

import { IMAGE_RESIZE, chooseUploadVersion, formatBytes, isDownsizable } from "./imageResize";

describe("IMAGE_RESIZE", () => {
  it("matches the web app's sizes and qualities", () => {
    expect(IMAGE_RESIZE.workOrder).toEqual({ maxSide: 1024, quality: 0.7 });
    expect(IMAGE_RESIZE.jobPhoto).toEqual({ maxSide: 1280, quality: 0.75 });
    expect(IMAGE_RESIZE.receipt).toEqual({ maxSide: 1536, quality: 0.85 });
  });

  it("keeps receipts and checks the sharpest", () => {
    const { workOrder, jobPhoto, receipt } = IMAGE_RESIZE;
    expect(receipt.maxSide).toBeGreaterThan(Math.max(workOrder.maxSide, jobPhoto.maxSide));
    expect(receipt.quality).toBeGreaterThan(Math.max(workOrder.quality, jobPhoto.quality));
  });
});

describe("isDownsizable", () => {
  it("downsizes pictures of any type, HEIC included", () => {
    for (const type of ["image/jpeg", "image/heic", "image/HEIF", "image/png", "image/webp"]) {
      expect(isDownsizable(type)).toBe(true);
    }
  });

  it("leaves PDFs and unknown files alone", () => {
    expect(isDownsizable("application/pdf")).toBe(false);
    expect(isDownsizable("application/octet-stream")).toBe(false);
    expect(isDownsizable("")).toBe(false);
    expect(isDownsizable(undefined)).toBe(false);
  });
});

describe("chooseUploadVersion", () => {
  it("sends the downsized picture when it's smaller", () => {
    expect(
      chooseUploadVersion({
        originalMimeType: "image/jpeg",
        originalBytes: 2_400_000,
        resizedBytes: 180_000,
      }),
    ).toBe("resized");
  });

  it("keeps a small JPEG that re-encoding made bigger", () => {
    expect(
      chooseUploadVersion({
        originalMimeType: "image/jpeg",
        originalBytes: 60_000,
        resizedBytes: 95_000,
      }),
    ).toBe("original");
  });

  it("always converts HEIC and PNG to JPEG, even when that's bigger", () => {
    for (const originalMimeType of ["image/heic", "image/png"]) {
      expect(
        chooseUploadVersion({ originalMimeType, originalBytes: 50_000, resizedBytes: 90_000 }),
      ).toBe("resized");
    }
  });

  it("uses the downsized picture when a size is unknown", () => {
    expect(
      chooseUploadVersion({
        originalMimeType: "image/jpeg",
        originalBytes: undefined,
        resizedBytes: 90_000,
      }),
    ).toBe("resized");
  });
});

describe("formatBytes", () => {
  it("shows kilobytes under a megabyte and megabytes above", () => {
    expect(formatBytes(312_400)).toBe("312 KB");
    expect(formatBytes(120)).toBe("1 KB");
    expect(formatBytes(2_140_000)).toBe("2.1 MB");
  });
});
