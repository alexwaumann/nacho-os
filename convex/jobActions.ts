"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { extractJobFromImages } from "./lib/ai";
import { geocodeAddress } from "./lib/geo";

/**
 * Background action to process a job document using Gemini and Google Maps
 */
export const processJobAction = internalAction({
  args: {
    queueId: v.id("jobProcessingQueue"),
  },
  handler: async (ctx, args) => {
    // 1. Update status to processing
    await ctx.runMutation(internal.jobs.updateQueueStatus, {
      queueId: args.queueId,
      status: "processing",
    });

    try {
      // 2. Get queue item and files
      const queueItem = await ctx.runQuery(internal.jobs.getQueueItemInternal, {
        queueId: args.queueId,
      });
      if (!queueItem) throw new Error("Queue item not found");

      const images: Array<{ base64: string; mimeType: string }> = [];
      for (const storageId of queueItem.fileStorageIds) {
        const blob = await ctx.storage.get(storageId);
        if (!blob) continue;

        const arrayBuffer = await blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        images.push({ base64, mimeType: blob.type });
      }

      if (images.length === 0) throw new Error("No images found in storage");

      // 3. Call Gemini via shared utility
      const extractedJob = await extractJobFromImages(images);

      // 4. Validate Address
      if (!extractedJob.propertyAddress) {
        throw new Error("Could not extract property address from the document.");
      }

      // 5. Geocode Address via shared utility
      const coordinates = await geocodeAddress(extractedJob.propertyAddress);

      // 6. Finalize Job
      const tasks = (extractedJob.tasks || []).map((task, idx) => ({
        id: `task-${idx}-${Date.now()}`,
        category: task.category || "General",
        taskName: task.taskName,
        specificInstructions: task.specificInstructions || undefined,
        quantity: typeof task.quantity === "number" ? task.quantity : undefined,
        unit: task.unit || undefined,
        materials: Array.isArray(task.materialsNeeded) ? task.materialsNeeded : [],
        tools: Array.isArray(task.toolsNeeded) ? task.toolsNeeded : [],
        requiresOnlineOrder: !!task.requiresOnlineOrder,
        completed: false,
      }));

      await ctx.runMutation(internal.jobs.finalizeJob, {
        queueId: args.queueId,
        address: extractedJob.propertyAddress,
        summary: extractedJob.jobSummary,
        tasks,
        accessCodes: Array.isArray(extractedJob.accessCodes) ? extractedJob.accessCodes : [],
        dueDate: extractedJob.targetCompletionDate,
        coordinates: coordinates || undefined,
        sourceImageIds: queueItem.fileStorageIds,
      });
    } catch (error) {
      console.error("Processing failed:", error);
      await ctx.runMutation(internal.jobs.cleanupFailedJob, {
        queueId: args.queueId,
        error: error instanceof Error ? error.message : "Unknown processing error",
      });
    }
  },
});
