"use node";

import { ConvexError, v } from "convex/values";

import { action } from "./_generated/server";
import { coordinatesValidator, weatherRiskValidator } from "./schema";
import { createGeminiClient } from "./lib/ai";
import { requireIdentity } from "./lib/auth";
import { requestRouteBrief } from "./lib/routeBriefAgent";
import { calculateDistance } from "./lib/routing";
import { getTodayHourlyForecast } from "./lib/weather";
import type { RouteBrief } from "./lib/routeBriefAgent";
import type { Coordinates } from "./lib/routing";

const MAX_STOPS = 15;
const KM_PER_MILE = 1.609344;
const toMiles = (from: Coordinates | undefined, to: Coordinates | undefined) =>
  from && to ? Math.round(calculateDistance(from, to) / KM_PER_MILE) : null;

const routeBriefStopValidator = v.object({
  address: v.string(),
  coordinates: v.optional(coordinatesValidator),
  /** Drive time from the previous stop (or from the start), seconds */
  legSeconds: v.optional(v.number()),
  /** Estimated arrival, ms (see estimateRouteArrivals) */
  arrivalTime: v.number(),
  /** Tasks not done yet */
  pendingTasks: v.array(
    v.object({
      taskName: v.string(),
      category: v.optional(v.string()),
      area: v.optional(v.string()),
      specificInstructions: v.optional(v.string()),
    }),
  ),
  weatherRisk: v.optional(weatherRiskValidator),
});

/**
 * Write the daily weather brief for today's route: a plain headline, a note for each stop the
 * weather affects, and (only when it clearly helps) a better order for the stops.
 * Fetches each site's hourly forecast for today on the server. The client saves the result with
 * routeBriefs.save.
 */
export const generate = action({
  args: {
    /** The user's local date and time with weekday, e.g. "Tuesday, October 6, 2026, 8:20 AM" */
    today: v.string(),
    /** IANA time zone of the user, e.g. "America/Chicago" */
    timeZone: v.string(),
    /** When the day's driving starts, ms (see getRouteStartTime) */
    startTime: v.number(),
    homeCoordinates: v.optional(coordinatesValidator),
    /** Route stops in their current order */
    stops: v.array(routeBriefStopValidator),
  },
  handler: async (ctx, args): Promise<RouteBrief> => {
    await requireIdentity(ctx);
    const { stops, homeCoordinates } = args;

    if (stops.length === 0) throw new ConvexError("No stops on the route");
    if (stops.length > MAX_STOPS) throw new ConvexError("Too many stops on the route");
    try {
      // Throws a RangeError for unknown time zones
      new Intl.DateTimeFormat("en-US", { timeZone: args.timeZone });
    } catch {
      throw new ConvexError(`Unknown time zone: ${args.timeZone}`);
    }

    // One forecast per site; a failed fetch just leaves that stop without one
    const forecasts = await Promise.all(
      stops.map((stop) =>
        stop.coordinates ?
          getTodayHourlyForecast(stop.coordinates).catch((error: unknown) => {
            console.warn(`Route brief: no forecast for ${stop.address}`, error);
            return null;
          })
        : Promise.resolve(null),
      ),
    );

    if (forecasts.every((forecast) => forecast === null)) {
      throw new ConvexError("Couldn't get the weather for any of your stops");
    }

    const { ms, usage, ...brief } = await requestRouteBrief(createGeminiClient(), {
      today: args.today,
      timeZone: args.timeZone,
      startTime: args.startTime,
      hasHome: homeCoordinates !== undefined,
      stops: stops.map(({ coordinates: _coordinates, ...stop }, index) => ({
        ...stop,
        forecast: forecasts[index],
      })),
      miles: {
        fromHome:
          homeCoordinates ? stops.map((stop) => toMiles(homeCoordinates, stop.coordinates)) : null,
        between: stops.map((from) => stops.map((to) => toMiles(from.coordinates, to.coordinates))),
      },
    });

    const suggestion = brief.suggestion ? ` → order ${brief.suggestion.order.join(",")}` : "";
    console.log(
      `Route brief (${ms}ms, ${usage?.input ?? "?"} in / ${usage?.output ?? "?"} out): ${brief.headline}${suggestion}`,
    );

    return brief;
  },
});
