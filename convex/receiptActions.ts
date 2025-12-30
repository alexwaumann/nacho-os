"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { extractReceiptFromImage } from "./lib/ai";

/**
 * Background action to process a receipt image using Gemini
 */
export const processReceiptAction = internalAction({
  args: {
    queueId: v.id("receiptProcessingQueue"),
  },
  handler: async (ctx, args) => {
    // 1. Update status to processing
    await ctx.runMutation(internal.receipts.updateReceiptQueueStatus, {
      queueId: args.queueId,
      status: "processing",
    });

    try {
      // 2. Get queue item
      const queueItem = await ctx.runQuery(internal.receipts.getReceiptQueueItemInternal, {
        queueId: args.queueId,
      });
      if (!queueItem) throw new Error("Queue item not found");

      // 3. Fetch image from storage
      const blob = await ctx.storage.get(queueItem.imageStorageId);
      if (!blob) throw new Error("Image not found in storage");

      const arrayBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const image = { base64, mimeType: blob.type };

      // 4. Extract receipt data via Gemini
      const extractedReceipt = await extractReceiptFromImage(image);

      // 5. Finalize receipt (creates record, deletes queue item)
      await ctx.runMutation(internal.receipts.finalizeReceipt, {
        queueId: args.queueId,
        storeName: extractedReceipt.storeName,
        storeLocation: extractedReceipt.storeLocation,
        summary: extractedReceipt.summary,
        total: extractedReceipt.total,
        date: extractedReceipt.date,
      });
    } catch (error) {
      console.error("Receipt processing failed:", error);
      await ctx.runMutation(internal.receipts.cleanupFailedReceipt, {
        queueId: args.queueId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
