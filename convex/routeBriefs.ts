import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const severityValidator = v.union(v.literal("calm"), v.literal("watch"), v.literal("act"));

const siteNoteValidator = v.object({ jobId: v.id("jobs"), note: v.string() });

const suggestionValidator = v.object({ order: v.array(v.id("jobs")), reason: v.string() });

// --- Helpers ---

async function findUserId(ctx: QueryCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user?._id ?? null;
}

async function getUserId(ctx: QueryCtx) {
  const userId = await findUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

async function getOwnBrief(ctx: MutationCtx, briefId: Id<"routeBriefs">) {
  const userId = await getUserId(ctx);
  const brief = await ctx.db.get(briefId);
  if (!brief || brief.userId !== userId) {
    throw new Error("Route brief not found or unauthorized");
  }
  return brief;
}

// --- QUERIES ---

/**
 * The brief for this set of route jobs on the given local date, or null if there isn't one
 */
export const getForToday = query({
  args: { date: v.string(), jobSetKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await findUserId(ctx);
    if (!userId || !args.jobSetKey) return null;

    const briefs = await ctx.db
      .query("routeBriefs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .collect();

    return briefs.find((brief) => brief.jobSetKey === args.jobSetKey) ?? null;
  },
});

// --- MUTATIONS ---

/**
 * Save a freshly generated brief, replacing any earlier one for the same date and set of jobs
 */
export const save = mutation({
  args: {
    date: v.string(),
    jobSetKey: v.string(),
    orderKey: v.string(),
    headline: v.string(),
    severity: v.optional(severityValidator),
    siteNotes: v.array(siteNoteValidator),
    suggestion: v.optional(suggestionValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Notes and suggestions may only point at jobs in this brief's job set
    const jobIds = new Set(args.jobSetKey.split(","));
    const referencedIds = [
      ...args.siteNotes.map((note) => note.jobId),
      ...(args.suggestion?.order ?? []),
    ];
    if (referencedIds.some((jobId) => !jobIds.has(jobId))) {
      throw new Error("Route brief refers to a job that isn't on the route");
    }

    const fields = {
      orderKey: args.orderKey,
      headline: args.headline,
      severity: args.severity,
      siteNotes: args.siteNotes,
      suggestion: args.suggestion,
      suggestionDismissed: false,
      generatedAt: Date.now(),
    };

    const existing = (
      await ctx.db
        .query("routeBriefs")
        .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
        .collect()
    ).find((brief) => brief.jobSetKey === args.jobSetKey);

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }

    return await ctx.db.insert("routeBriefs", {
      userId,
      date: args.date,
      jobSetKey: args.jobSetKey,
      ...fields,
    });
  },
});

/**
 * "Keep my order": hide the suggested order
 */
export const dismissSuggestion = mutation({
  args: { briefId: v.id("routeBriefs") },
  handler: async (ctx, args) => {
    await getOwnBrief(ctx, args.briefId);
    await ctx.db.patch(args.briefId, { suggestionDismissed: true });
    return true;
  },
});

/**
 * "Use this order": the route now follows the suggestion, so it's done
 */
export const markSuggestionApplied = mutation({
  args: { briefId: v.id("routeBriefs") },
  handler: async (ctx, args) => {
    const brief = await getOwnBrief(ctx, args.briefId);
    await ctx.db.patch(args.briefId, {
      orderKey: brief.suggestion ? brief.suggestion.order.join(",") : brief.orderKey,
      suggestion: undefined,
    });
    return true;
  },
});

/**
 * The route was reordered by hand, so the suggestion no longer applies.
 * The headline and site notes stay, since the same jobs are still on the route.
 */
export const clearSuggestion = mutation({
  args: { briefId: v.id("routeBriefs"), orderKey: v.string() },
  handler: async (ctx, args) => {
    await getOwnBrief(ctx, args.briefId);
    await ctx.db.patch(args.briefId, { orderKey: args.orderKey, suggestion: undefined });
    return true;
  },
});
