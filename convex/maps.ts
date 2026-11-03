import { v } from "convex/values";

import { action } from "./_generated/server";
import {
  calculateRouteMetrics as calculateRouteMetricsFromGoogle,
  geocodeAddress as geocodeAddressWithGoogle,
  getPlaceSuggestions as getPlaceSuggestionsFromGoogle,
  optimizeRoute as optimizeRouteWithGoogle,
} from "./lib/geo";
import type { ActionCtx } from "./_generated/server";

// Google Maps APIs are paid, so only signed-in users may call them
async function requireIdentity(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity;
}

const coordinatesValidator = v.object({
  lat: v.number(),
  lng: v.number(),
});

const waypointValidator = v.object({
  coordinates: coordinatesValidator,
  address: v.string(),
});

/**
 * Geocode an address to coordinates, or null when Google can't find it
 */
export const geocodeAddress = action({
  args: { address: v.string() },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    return await geocodeAddressWithGoogle(args.address);
  },
});

/**
 * Address autocomplete suggestions, biased towards the user's coordinates when given
 */
export const getPlaceSuggestions = action({
  args: {
    query: v.string(),
    userCoordinates: v.optional(coordinatesValidator),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    return await getPlaceSuggestionsFromGoogle(args.query, args.userCoordinates);
  },
});

/**
 * Best order for the waypoints between origin and destination, with per-leg metrics
 */
export const optimizeRoute = action({
  args: {
    origin: coordinatesValidator,
    destination: coordinatesValidator,
    waypoints: v.array(waypointValidator),
    optimize: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    return await optimizeRouteWithGoogle(args);
  },
});

/**
 * Per-stop and total drive metrics for the waypoints in the given order
 */
export const calculateRouteMetrics = action({
  args: {
    origin: coordinatesValidator,
    waypoints: v.array(waypointValidator),
    // The user's home address. If not set, the route ends at the last waypoint
    destination: v.optional(coordinatesValidator),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    return await calculateRouteMetricsFromGoogle(args);
  },
});
