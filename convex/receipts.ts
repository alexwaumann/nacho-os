import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

// --- Helper to get user ID ---
async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
  db: any;
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("User not found");
  }

  return user._id;
}

/**
 * Add a receipt to a job
 */
export const create = mutation({
  args: {
    jobId: v.id("jobs"),
    imageId: v.id("_storage"),
    storeName: v.string(),
    storeLocation: v.optional(v.string()),
    summary: v.optional(v.string()),
    total: v.number(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify job belongs to user
    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    const receiptId = await ctx.db.insert("receipts", {
      userId,
      jobId: args.jobId,
      imageId: args.imageId,
      storeName: args.storeName,
      storeLocation: args.storeLocation,
      summary: args.summary,
      total: args.total,
      date: args.date,
    });

    return receiptId;
  },
});

/**
 * Get all receipts for a job
 */
export const listByJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return [];

    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== user._id) return [];

    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Add image URLs
    const receiptsWithUrls = await Promise.all(
      receipts.map(async (receipt) => ({
        ...receipt,
        imageUrl: await ctx.storage.getUrl(receipt.imageId),
      })),
    );

    return receiptsWithUrls;
  },
});

/**
 * Get total expenses for a job
 */
export const getTotalByJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return 0;

    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    return receipts.reduce((sum, r) => sum + r.total, 0);
  },
});

/**
 * Delete a receipt
 */
export const remove = mutation({
  args: {
    receiptId: v.id("receipts"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.userId !== userId) {
      throw new Error("Receipt not found or unauthorized");
    }

    // Delete the image from storage
    await ctx.storage.delete(receipt.imageId);

    // Delete the receipt
    await ctx.db.delete(args.receiptId);

    return args.receiptId;
  },
});

// --- RECEIPT PROCESSING QUEUE ---

/**
 * Enqueue a receipt for background processing
 */
export const enqueueReceipt = mutation({
  args: {
    jobId: v.id("jobs"),
    imageStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify job belongs to user
    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    const queueId = await ctx.db.insert("receiptProcessingQueue", {
      userId,
      jobId: args.jobId,
      imageStorageId: args.imageStorageId,
      status: "queued",
    });

    // Schedule the background action
    await ctx.scheduler.runAfter(0, internal.receiptActions.processReceiptAction, { queueId });

    return queueId;
  },
});

/**
 * Update receipt queue item status (internal)
 */
export const updateReceiptQueueStatus = internalMutation({
  args: {
    queueId: v.id("receiptProcessingQueue"),
    status: v.union(v.literal("processing"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: args.status,
      error: args.error,
    });
  },
});

/**
 * Finalize a processed receipt and remove from queue (internal)
 */
export const finalizeReceipt = internalMutation({
  args: {
    queueId: v.id("receiptProcessingQueue"),
    storeName: v.string(),
    storeLocation: v.optional(v.string()),
    summary: v.optional(v.string()),
    total: v.number(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const queueItem = await ctx.db.get(args.queueId);
    if (!queueItem) throw new Error("Queue item not found");

    // Create the receipt
    await ctx.db.insert("receipts", {
      userId: queueItem.userId,
      jobId: queueItem.jobId,
      imageId: queueItem.imageStorageId,
      storeName: args.storeName,
      storeLocation: args.storeLocation,
      summary: args.summary,
      total: args.total,
      date: args.date,
    });

    // Remove from queue
    await ctx.db.delete(args.queueId);
  },
});

/**
 * Clean up a failed receipt processing and mark as failed (internal)
 */
export const cleanupFailedReceipt = internalMutation({
  args: {
    queueId: v.id("receiptProcessingQueue"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const queueItem = await ctx.db.get(args.queueId);
    if (!queueItem) return;

    // Update status to failed (keep the queue item so user can see the error)
    await ctx.db.patch(args.queueId, {
      status: "failed",
      error: args.error,
    });
  },
});

/**
 * Get a receipt queue item (internal)
 */
export const getReceiptQueueItemInternal = internalQuery({
  args: { queueId: v.id("receiptProcessingQueue") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.queueId);
  },
});

/**
 * List receipt queue items for a job (for UI processing state)
 */
export const listQueueByJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return [];

    // Verify job belongs to user
    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== user._id) return [];

    return await ctx.db
      .query("receiptProcessingQueue")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

/**
 * Dismiss a failed receipt queue item
 */
export const dismissQueueItem = mutation({
  args: {
    queueId: v.id("receiptProcessingQueue"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const queueItem = await ctx.db.get(args.queueId);
    if (!queueItem || queueItem.userId !== userId) {
      throw new Error("Queue item not found or unauthorized");
    }

    // Delete the image from storage
    await ctx.storage.delete(queueItem.imageStorageId);

    // Delete the queue item
    await ctx.db.delete(args.queueId);

    return args.queueId;
  },
});
