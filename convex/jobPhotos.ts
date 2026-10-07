import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

// Photos he takes on a job site, stored downsized on the client before upload

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

const MAX_CAPTION_LENGTH = 200;

const cleanCaption = (caption: string | undefined) => {
  const trimmed = caption?.trim().slice(0, MAX_CAPTION_LENGTH);
  return trimmed ? trimmed : undefined;
};

/**
 * Add an uploaded photo to a job, with an optional caption
 */
export const create = mutation({
  args: {
    jobId: v.id("jobs"),
    imageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Job not found or unauthorized");
    }

    return await ctx.db.insert("jobPhotos", {
      userId,
      jobId: args.jobId,
      imageId: args.imageId,
      caption: cleanCaption(args.caption),
    });
  },
});

/**
 * A job's photos in the order they were taken, with image URLs
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

    const photos = await ctx.db
      .query("jobPhotos")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    return await Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        imageUrl: await ctx.storage.getUrl(photo.imageId),
      })),
    );
  },
});

/**
 * Set or clear (empty string) one photo's caption
 */
export const setCaption = mutation({
  args: {
    photoId: v.id("jobPhotos"),
    caption: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.userId !== userId) {
      throw new Error("Photo not found or unauthorized");
    }

    await ctx.db.patch(args.photoId, { caption: cleanCaption(args.caption) });
    return args.photoId;
  },
});

/**
 * Set several photos' captions at once (a voice command, and its undo). Photos that were
 * deleted in the meantime are skipped.
 */
export const setCaptions = mutation({
  args: {
    jobId: v.id("jobs"),
    captions: v.array(v.object({ photoId: v.id("jobPhotos"), caption: v.string() })),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    for (const { photoId, caption } of args.captions) {
      const photo = await ctx.db.get(photoId);
      if (!photo || photo.userId !== userId || photo.jobId !== args.jobId) continue;
      await ctx.db.patch(photoId, { caption: cleanCaption(caption) });
    }
    return args.jobId;
  },
});

/**
 * Delete a photo and its stored image
 */
export const remove = mutation({
  args: {
    photoId: v.id("jobPhotos"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.userId !== userId) {
      throw new Error("Photo not found or unauthorized");
    }

    await ctx.storage.delete(photo.imageId);
    await ctx.db.delete(args.photoId);
    return args.photoId;
  },
});
