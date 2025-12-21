import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

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
