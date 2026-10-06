import { GoogleGenAI } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";

import type { RouteBrief, RouteBriefTask } from "@/features/jobs/lib/routeBriefAgent";
import type { Coordinates } from "@/server/weather";
import { env } from "@/env";
import { requestRouteBrief } from "@/features/jobs/lib/routeBriefAgent";
import { calculateDistance } from "@/server/geo";
import { getTodayHourlyForecast } from "@/server/weather";

const MAX_STOPS = 15;
const KM_PER_MILE = 1.609344;

export type { RouteBrief };

export interface RouteBriefStopInput {
  address: string;
  coordinates?: Coordinates;
  /** Drive time from the previous stop (or from the start), seconds */
  legSeconds?: number;
  /** Estimated arrival, ms (see estimateRouteArrivals) */
  arrivalTime: number;
  /** Tasks not done yet */
  pendingTasks: Array<RouteBriefTask>;
  weatherRisk?: { hasRisk: boolean; reason?: string };
}

export interface RouteBriefInput {
  /** The user's local date and time with weekday, e.g. "Tuesday, October 6, 2026, 8:20 AM" */
  today: string;
  /** IANA time zone of the user, e.g. "America/Chicago" */
  timeZone: string;
  /** When the day's driving starts, ms (see getRouteStartTime) */
  startTime: number;
  homeCoordinates?: Coordinates;
  /** Route stops in their current order */
  stops: Array<RouteBriefStopInput>;
}

const toMiles = (from: Coordinates | undefined, to: Coordinates | undefined) =>
  from && to ? Math.round(calculateDistance(from, to) / KM_PER_MILE) : null;

/**
 * Write the daily weather brief for today's route: a plain headline, a note for each stop the
 * weather affects, and (only when it clearly helps) a better order for the stops.
 * Fetches each site's hourly forecast for today on the server.
 */
export const generateRouteBrief = createServerFn({ method: "POST" })
  .inputValidator((data: RouteBriefInput) => {
    if (data.stops.length === 0) throw new Error("No stops on the route");
    if (data.stops.length > MAX_STOPS) throw new Error("Too many stops on the route");
    // Throws a RangeError for unknown time zones
    new Intl.DateTimeFormat("en-US", { timeZone: data.timeZone });
    return data;
  })
  .handler(async ({ data }): Promise<RouteBrief> => {
    const { stops, homeCoordinates } = data;

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
      throw new Error("Couldn't get the weather for any of your stops");
    }

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const { ms, usage, ...brief } = await requestRouteBrief(ai, {
      today: data.today,
      timeZone: data.timeZone,
      startTime: data.startTime,
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
  });
