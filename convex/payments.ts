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
 * Add a payment (check) to a job
 */
export const create = mutation({
  args: {
    jobId: v.id("jobs"),
    imageId: v.id("_storage"),
    amount: v.number(),
    payerName: v.optional(v.string()),
    detectedAddress: v.optional(v.string()),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify job belongs to user
    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    const paymentId = await ctx.db.insert("payments", {
      userId,
      jobId: args.jobId,
      imageId: args.imageId,
      amount: args.amount,
      payerName: args.payerName,
      detectedAddress: args.detectedAddress,
      date: args.date,
    });

    // Mark job as paid
    await ctx.db.patch(args.jobId, {
      status: "paid",
      paidOn: new Date().toISOString().split("T")[0],
    });

    return paymentId;
  },
});

/**
 * Get payment for a job
 */
export const getByJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return null;

    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== user._id) return null;

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    if (payments.length === 0) return null;

    const payment = payments[0];
    return {
      ...payment,
      imageUrl: await ctx.storage.getUrl(payment.imageId),
    };
  },
});

/**
 * Delete a payment
 */
export const remove = mutation({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const payment = await ctx.db.get(args.paymentId);
    if (!payment || payment.userId !== userId) {
      throw new Error("Payment not found or unauthorized");
    }

    // Update job status back to completed
    const job = await ctx.db.get(payment.jobId);
    if (job && job.status === "paid") {
      await ctx.db.patch(payment.jobId, {
        status: "completed",
        paidOn: undefined,
      });
    }

    // Delete the image from storage
    await ctx.storage.delete(payment.imageId);

    // Delete the payment
    await ctx.db.delete(args.paymentId);

    return args.paymentId;
  },
});
