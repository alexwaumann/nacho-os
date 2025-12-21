import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

// Reusable validators
const taskValidator = v.object({
  id: v.string(),
  text: v.string(),
  requiresOnlineOrder: v.boolean(),
  completed: v.boolean(),
});

const coordinatesValidator = v.object({
  lat: v.number(),
  lng: v.number(),
});

const weatherDataValidator = v.object({
  tempMax: v.number(),
  precipProb: v.number(),
  condition: v.string(),
  code: v.number(),
});

const weatherRiskValidator = v.object({
  hasRisk: v.boolean(),
  reason: v.optional(v.string()),
});

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
    throw new Error("User not found. Please ensure user is synced.");
  }

  return user._id;
}

// --- MUTATIONS ---

/**
 * Create a new job
 */
export const create = mutation({
  args: {
    address: v.string(),
    summary: v.optional(v.string()),
    tasks: v.optional(v.array(taskValidator)),
    tools: v.optional(v.array(v.string())),
    materials: v.optional(v.array(v.string())),
    accessCodes: v.optional(v.array(v.string())),
    dueDate: v.optional(v.string()),
    coordinates: v.optional(coordinatesValidator),
    sourceImageIds: v.optional(v.array(v.id("_storage"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const jobId = await ctx.db.insert("jobs", {
      userId,
      type: "stop",
      address: args.address,
      summary: args.summary,
      tasks: args.tasks ?? [],
      tools: args.tools ?? [],
      materials: args.materials ?? [],
      accessCodes: args.accessCodes ?? [],
      dueDate: args.dueDate,
      coordinates: args.coordinates,
      sourceImageIds: args.sourceImageIds ?? [],
      notes: args.notes,
      selectedForRoute: false,
      status: "pending",
    });

    return jobId;
  },
});

/**
 * Update a job's basic fields
 */
export const update = mutation({
  args: {
    jobId: v.id("jobs"),
    address: v.optional(v.string()),
    summary: v.optional(v.string()),
    tasks: v.optional(v.array(taskValidator)),
    tools: v.optional(v.array(v.string())),
    materials: v.optional(v.array(v.string())),
    accessCodes: v.optional(v.array(v.string())),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    coordinates: v.optional(coordinatesValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    const { jobId, ...updates } = args;

    await ctx.db.patch(jobId, updates);
    return jobId;
  },
});

/**
 * Delete a job and its associated files
 */
export const remove = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    // Delete associated source images from storage
    if (job.sourceImageIds) {
      for (const imageId of job.sourceImageIds) {
        await ctx.storage.delete(imageId);
      }
    }

    // Delete associated receipts
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_job", (q: any) => q.eq("jobId", args.jobId))
      .collect();

    for (const receipt of receipts) {
      await ctx.storage.delete(receipt.imageId);
      await ctx.db.delete(receipt._id);
    }

    // Delete associated payments
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_job", (q: any) => q.eq("jobId", args.jobId))
      .collect();

    for (const payment of payments) {
      await ctx.storage.delete(payment.imageId);
      await ctx.db.delete(payment._id);
    }

    // Delete the job
    await ctx.db.delete(args.jobId);
    return args.jobId;
  },
});

/**
 * Update task completion status
 */
export const updateTask = mutation({
  args: {
    jobId: v.id("jobs"),
    taskId: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    const updatedTasks = (job.tasks ?? []).map((task) =>
      task.id === args.taskId ? { ...task, completed: args.completed } : task,
    );

    await ctx.db.patch(args.jobId, { tasks: updatedTasks });
    return args.jobId;
  },
});

/**
 * Reorder tasks
 */
export const reorderTasks = mutation({
  args: {
    jobId: v.id("jobs"),
    taskIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    const taskMap = new Map((job.tasks ?? []).map((t) => [t.id, t]));
    const reorderedTasks = args.taskIds
      .map((id) => taskMap.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);

    await ctx.db.patch(args.jobId, { tasks: reorderedTasks });
    return args.jobId;
  },
});

/**
 * Toggle job selection for route planning
 */
export const toggleSelectedForRoute = mutation({
  args: {
    jobId: v.id("jobs"),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    await ctx.db.patch(args.jobId, { selectedForRoute: args.selected });
    return args.jobId;
  },
});

/**
 * Update job status
 */
export const updateStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("paid")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "completed" && !job.completedOn) {
      updates.completedOn = new Date().toISOString().split("T")[0];
    } else if (args.status === "paid" && !job.paidOn) {
      updates.paidOn = new Date().toISOString().split("T")[0];
    }

    await ctx.db.patch(args.jobId, updates);
    return args.jobId;
  },
});

/**
 * Update job weather data
 */
export const updateWeather = mutation({
  args: {
    jobId: v.id("jobs"),
    weather: v.optional(weatherDataValidator),
    weatherRisk: v.optional(weatherRiskValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    await ctx.db.patch(args.jobId, {
      weather: args.weather,
      weatherRisk: args.weatherRisk,
    });
    return args.jobId;
  },
});

/**
 * Update route metrics for a job
 */
export const updateRouteMetrics = mutation({
  args: {
    jobId: v.id("jobs"),
    travelTime: v.optional(v.string()),
    distance: v.optional(v.string()),
    travelTimeValue: v.optional(v.number()),
    distanceValue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const job = await ctx.db.get(args.jobId);

    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    const { jobId, ...metrics } = args;
    await ctx.db.patch(jobId, metrics);
    return jobId;
  },
});

// --- QUERIES ---

/**
 * Get all jobs for the current user
 */
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"), v.literal("paid"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return [];

    let jobsQuery;
    if (args.status) {
      jobsQuery = ctx.db
        .query("jobs")
        .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", args.status!));
    } else {
      jobsQuery = ctx.db.query("jobs").withIndex("by_user", (q) => q.eq("userId", user._id));
    }

    const jobs = await jobsQuery.collect();

    // Sort by creation time (newest first)
    return jobs.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/**
 * Get a single job by ID
 */
export const get = query({
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

    return job;
  },
});

/**
 * Get jobs selected for route planning
 */
export const getSelectedForRoute = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return [];

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_user_selected", (q) => q.eq("userId", user._id).eq("selectedForRoute", true))
      .collect();

    return jobs;
  },
});

/**
 * Get job stats (counts by status)
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { pending: 0, completed: 0, paid: 0, totalExpenses: 0 };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return { pending: 0, completed: 0, paid: 0, totalExpenses: 0 };
    }

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const totalExpenses = receipts.reduce((sum, r) => sum + r.total, 0);

    return {
      pending: jobs.filter((j) => j.status === "pending").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      paid: jobs.filter((j) => j.status === "paid").length,
      totalExpenses,
    };
  },
});

/**
 * Get source image URLs for a job
 */
export const getSourceImageUrls = query({
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

    const urls: Array<string | null> = [];
    for (const imageId of job.sourceImageIds ?? []) {
      const url = await ctx.storage.getUrl(imageId);
      urls.push(url);
    }

    return urls.filter((url): url is string => url !== null);
  },
});
