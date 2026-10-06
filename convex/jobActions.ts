"use node";

import { GoogleGenAI } from "@google/genai";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { extractJob } from "./lib/jobExtraction";
import { geocodeAddress } from "./lib/geo";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import type { AccessCode, SourceFile } from "./lib/jobExtraction";
import { env } from "@/env";

// Keep inline Gemini requests well under the 20MB request limit
const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;

async function loadFile(
  ctx: ActionCtx,
  storageId: Id<"_storage">,
  maxBytes = Infinity,
): Promise<SourceFile | null> {
  const blob = await ctx.storage.get(storageId);
  if (!blob || blob.size > maxBytes) return null;
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  return { base64, mimeType: blob.type };
}

/**
 * Prefer the original upload (native PDF or full-res photo); fall back to the stored page images.
 */
async function loadExtractionFiles(
  ctx: ActionCtx,
  sourceFileId: Id<"_storage"> | undefined,
  pageImageIds: Array<Id<"_storage">>,
): Promise<Array<SourceFile>> {
  if (sourceFileId) {
    const source = await loadFile(ctx, sourceFileId, MAX_SOURCE_FILE_BYTES);
    if (source) return [source];
  }

  const images: Array<SourceFile> = [];
  for (const storageId of pageImageIds) {
    const image = await loadFile(ctx, storageId);
    if (image) images.push(image);
  }
  return images;
}

function formatAccessCode({ code, kind, note }: AccessCode): string {
  const label = kind === "other" ? null : kind[0].toUpperCase() + kind.slice(1);
  return [label ? `${label}: ${code}` : code, note].filter(Boolean).join(" — ");
}

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

      const files = await loadExtractionFiles(
        ctx,
        queueItem.sourceFileId,
        queueItem.fileStorageIds,
      );
      if (files.length === 0) throw new Error("No document found in storage");

      // 3. Extract the job with Gemini
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const { job: extractedJob, warnings } = await extractJob(ai, files);
      if (warnings.length > 0) {
        console.warn(`Extraction warnings for ${queueItem.fileName}:`, warnings);
      }

      // 4. Validate Address
      if (!extractedJob.propertyAddress) {
        throw new Error("Could not extract property address from the document.");
      }

      // 5. Geocode Address via shared utility
      const coordinates = await geocodeAddress(extractedJob.propertyAddress);

      // 6. Finalize Job
      const tasks = extractedJob.tasks.map((task, idx) => ({
        id: `task-${idx}-${Date.now()}`,
        category: task.category,
        taskName: task.taskName,
        sourceItem: task.sourceItem,
        area: task.area ?? undefined,
        page: task.page,
        specificInstructions: task.specificInstructions || undefined,
        quantity: task.quantity ?? undefined,
        unit: task.unit ?? undefined,
        materials: task.materials,
        tools: task.tools,
        requiresOnlineOrder: task.requiresOnlineOrder,
        completed: false,
      }));

      await ctx.runMutation(internal.jobs.finalizeJob, {
        queueId: args.queueId,
        address: extractedJob.propertyAddress,
        summary: extractedJob.jobSummary || undefined,
        tasks,
        accessCodes: extractedJob.accessCodes.map(formatAccessCode),
        dueDate: extractedJob.dueDate ?? undefined,
        notes: extractedJob.notes.join("\n") || undefined,
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
