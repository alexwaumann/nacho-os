import type { ActionCtx } from "../_generated/server";

/**
 * Throws unless the caller is signed in, so the paid APIs behind public actions (Gemini) can't
 * be called anonymously.
 */
export async function requireIdentity(ctx: Pick<ActionCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity;
}
