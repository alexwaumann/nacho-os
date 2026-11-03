import { v } from "convex/values";

import { action } from "./_generated/server";
import { fetchHourlyForecast } from "./lib/weather";

/**
 * Current conditions plus the hourly forecast starting at the current hour
 */
export const getHourlyForecast = action({
  args: {
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await fetchHourlyForecast(args.coordinates, args.hours);
  },
});
