"use node";

import { action } from "./_generated/server";
import { scanCheckImage, scanReceiptImage } from "./lib/ai";
import { requireIdentity } from "./lib/auth";
import { assertImageOrPdf, mediaValidator } from "./lib/media";

/**
 * Read a receipt photo or PDF with Gemini (the website sends a PDF's first page as an image)
 */
export const analyzeReceipt = action({
  args: { image: mediaValidator },
  handler: async (ctx, { image }) => {
    await requireIdentity(ctx);
    assertImageOrPdf(image);
    return await scanReceiptImage(image);
  },
});

/**
 * Read a check photo or PDF with Gemini (the website sends a PDF's first page as an image)
 */
export const analyzeCheck = action({
  args: { image: mediaValidator },
  handler: async (ctx, { image }) => {
    await requireIdentity(ctx);
    assertImageOrPdf(image);
    return await scanCheckImage(image);
  },
});
