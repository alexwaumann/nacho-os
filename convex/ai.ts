"use node";

import { action } from "./_generated/server";
import { scanCheckImage, scanReceiptImage } from "./lib/ai";
import { requireIdentity } from "./lib/auth";
import { assertImage, mediaValidator } from "./lib/media";

/**
 * Read a receipt photo (or a PDF's first page, rendered on the client) with Gemini
 */
export const analyzeReceipt = action({
  args: { image: mediaValidator },
  handler: async (ctx, { image }) => {
    await requireIdentity(ctx);
    assertImage(image);
    return await scanReceiptImage(image);
  },
});

/**
 * Read a check photo (or a PDF's first page, rendered on the client) with Gemini
 */
export const analyzeCheck = action({
  args: { image: mediaValidator },
  handler: async (ctx, { image }) => {
    await requireIdentity(ctx);
    assertImage(image);
    return await scanCheckImage(image);
  },
});
