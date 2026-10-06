import * as z from "zod";
import { VOICE_MODEL, VOICE_THINKING } from "../../voice/lib/agent";
import { ON_SITE_MINUTES } from "./arrival";
import type { GoogleGenAI, ThinkingLevel } from "@google/genai";

import type { WorkdayForecastSlot } from "@/server/weather";

// Server-only: writes the daily weather brief for the route with Gemini

export const ROUTE_BRIEF_MODEL = VOICE_MODEL;

const HOUR = 60 * 60 * 1000;

/** Forecast hours shown to the model: from the start of the day's driving until evening */
const WORKDAY_FIRST_HOUR = 6;
const WORKDAY_LAST_HOUR = 20;

/** Straight-line miles a suggested order may add before it's dropped as too much driving */
export const MAX_EXTRA_STRAIGHT_MILES = 50;

export const routeBriefResponseSchema = z.object({
  headline: z
    .string()
    .describe("1-2 short, plain sentences for the top of the Today page, spoken to the user"),
  severity: z
    .enum(["calm", "watch", "act"])
    .describe(
      "calm: nothing to worry about. watch: worth knowing, plan unchanged. act: weather will likely stop or spoil work at a stop",
    ),
  siteNotes: z
    .array(
      z.object({
        stopIndex: z.number().describe("stopIndex from the route data"),
        note: z.string().describe("One short, plain line about the weather for this stop"),
      }),
    )
    .describe("Only stops where the weather matters for the work still to do there"),
  suggestion: z
    .object({
      order: z.array(z.number()).describe("Every stopIndex exactly once, in the new order"),
      reason: z.string().describe("1-2 plain sentences on what the new order gets the user"),
    })
    .nullable()
    .describe("A better order of stops, or null when the current order is fine"),
});

export type RouteBriefResponse = z.infer<typeof routeBriefResponseSchema>;
export type RouteBriefSeverity = RouteBriefResponse["severity"];

export interface RouteBrief {
  headline: string;
  severity: RouteBriefSeverity;
  siteNotes: Array<{ stopIndex: number; note: string }>;
  suggestion: { order: Array<number>; reason: string } | null;
}

export interface RouteBriefTask {
  taskName: string;
  category?: string;
  area?: string;
  specificInstructions?: string;
}

export interface RouteBriefAgentStop {
  address: string;
  /** Drive time from the previous stop (or from the start), seconds */
  legSeconds?: number;
  /** Estimated arrival, ms */
  arrivalTime: number;
  pendingTasks: Array<RouteBriefTask>;
  weatherRisk?: { hasRisk: boolean; reason?: string };
  /** Today's hourly forecast at the site; null when it couldn't be fetched */
  forecast: Array<WorkdayForecastSlot> | null;
}

export interface RouteBriefAgentInput {
  /** e.g. "Tuesday, October 6, 2026, 8:20 AM" */
  today: string;
  /** IANA time zone of the user, e.g. "America/Chicago" */
  timeZone: string;
  /** When the day's driving starts, ms */
  startTime: number;
  hasHome: boolean;
  stops: Array<RouteBriefAgentStop>;
  /** Straight-line miles; null where a stop (or home) has no coordinates */
  miles: {
    fromHome: Array<number | null> | null;
    between: Array<Array<number | null>>;
  };
}

const responseJsonSchema = (() => {
  const { $schema: _schema, ...schema } = z.toJSONSchema(routeBriefResponseSchema);
  return schema;
})();

// Compact JSON without empty fields: fewer tokens, so cheaper and a little faster
const omitEmpty = (_key: string, value: unknown) =>
  value === "" || value === undefined || (Array.isArray(value) && value.length === 0) ?
    undefined
  : value;

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function createTimeFormatters(timeZone: string) {
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  const hour = new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone });
  const hour24 = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone });
  return {
    time: (ms: number) => time.format(ms),
    hour: (ms: number) => hour.format(ms),
    hourOfDay: (ms: number) => Number(hour24.format(ms)),
  };
}

function describeSlot(slot: WorkdayForecastSlot, label: string) {
  const parts = [`${label}: ${slot.temp}°F ${slot.condition}`];
  if (slot.precipProb > 0) parts.push(`rain chance ${slot.precipProb}%`);
  parts.push(`wind ${slot.windMph} mph`);
  if (slot.gustMph >= slot.windMph + 10) parts.push(`gusts ${slot.gustMph} mph`);
  return parts.join(", ");
}

export function buildRouteBriefContext(input: RouteBriefAgentInput) {
  const format = createTimeFormatters(input.timeZone);
  const fromTime = input.startTime - HOUR;

  return {
    now: `${input.today} (${input.timeZone})`,
    startsFrom: input.hasHome ? "home" : "where the user is now",
    leavesAround: format.time(input.startTime),
    stops: input.stops.map((stop, stopIndex) => ({
      stopIndex,
      address: stop.address,
      driveFromPrevious:
        stop.legSeconds !== undefined ? formatDuration(stop.legSeconds) : "unknown",
      arriveAround: format.time(stop.arrivalTime),
      leaveAround: format.time(stop.arrivalTime + ON_SITE_MINUTES * 60 * 1000),
      tasksStillToDo: stop.pendingTasks.map((task) => ({
        task: task.taskName,
        category: task.category,
        area: task.area,
        instructions: task.specificInstructions,
      })),
      earlierWeatherWarning: stop.weatherRisk?.hasRisk ? stop.weatherRisk.reason : undefined,
      hourlyForecast:
        stop.forecast ?
          stop.forecast
            .filter((slot) => {
              const hour = format.hourOfDay(slot.time);
              return (
                slot.time >= fromTime && hour >= WORKDAY_FIRST_HOUR && hour <= WORKDAY_LAST_HOUR
              );
            })
            .map((slot) => describeSlot(slot, format.hour(slot.time)))
        : "unavailable",
    })),
    straightLineMiles: {
      fromHomeToEachStop: input.miles.fromHome ?? undefined,
      betweenStops: input.miles.between,
    },
  };
}

export function buildRouteBriefPrompt(input: RouteBriefAgentInput) {
  const stopCount = input.stops.length;

  return `You write the daily weather brief in a handyman's job app. The user is a 62-year-old \
handyman who drives between job sites that can be two or three hours apart, so the weather can be \
different at each stop. He reads this on his phone before he heads out.

He drives to the ${stopCount === 1 ? "stop" : `${stopCount} stops`} below in the order listed, \
starting from ${input.hasHome ? "home and going back home at the end" : "where he is now"}. The \
arrival times assume he leaves at ${createTimeFormatters(input.timeZone).time(input.startTime)} and \
spends about ${ON_SITE_MINUTES} minutes at each stop. Each stop has its own hourly forecast, in his \
local time.

What to write:
- headline: 1 or 2 short sentences about what matters most for the rest of today: when and where \
bad weather arrives, and which outside work it affects. Name the place by street or town, e.g. \
"Rain moves into Lufkin around 2 PM. The Oak Street job has outside painting still to do." If \
nothing is concerning, say so briefly, e.g. "Dry and mild at all three stops today."
- severity: "calm" when nothing is concerning, "watch" when it's worth knowing but doesn't change \
the plan, "act" when weather will likely stop or spoil work at a stop.
- siteNotes: at most one short line per stop, only for stops where the weather matters for the \
work still to do there (rain or storms on outside work, strong wind for ladders or roofs, heat, \
freezing). Leave the rest out. Use the stop's stopIndex.
- suggestion: a better order for the stops, or null.

When to suggest a new order:
- Only when it clearly helps get the work done, e.g. a stop with outside work gets rain in the \
afternoon but is dry in the morning, so going there first means the work gets done.
- Never just to save a little driving.
- Keep the total driving reasonable. driveFromPrevious is the drive time for the current order; \
for other orders, use straightLineMiles as a guide (real roads are longer). Don't suggest an order \
that adds more than about an hour of driving.
- order lists every stopIndex (0 to ${stopCount - 1}) exactly once, in the new order. reason: 1 \
or 2 plain sentences on what it gets him, e.g. "Do the Oak Street painting first, before the rain \
gets there around 2 PM."
- If the current order already works, or there's only one stop, suggestion is null.

How to write:
- Speak to him as "you". Plain, everyday words and short sentences. No jargon, no markdown, no \
emoji.
- No percentages. Say "rain likely around 2 PM", "a chance of showers", "storms in the afternoon".
- Mention temperatures only when they matter for the work or his safety (very hot, near or below \
freezing), e.g. "near freezing until 9 AM".
- Times like "2 PM" or "around noon".
- Refer to stops by street or town ("the Oak Street job", "in Lufkin"), never by number.
- Only talk about the tasks listed for each stop. Never invent tasks, places or weather.
- Rain doesn't matter for indoor work (plumbing, interior painting, cabinets, flooring); don't warn \
about it.
- earlierWeatherWarning is an older, rougher check; trust the hourly forecast over it.

The route:
${JSON.stringify(buildRouteBriefContext(input), omitEmpty)}`;
}

function isPermutation(order: Array<number>, length: number) {
  if (order.length !== length) return false;
  const seen = new Set(order);
  return (
    seen.size === length &&
    order.every((index) => Number.isInteger(index) && index >= 0 && index < length)
  );
}

/** Straight-line miles for driving the stops in `order`; null when a distance is unknown */
export function routeMiles(order: Array<number>, miles: RouteBriefAgentInput["miles"]) {
  let total = 0;
  for (let i = 1; i < order.length; i++) {
    const leg = miles.between[order[i - 1]]?.[order[i]];
    if (leg == null) return null;
    total += leg;
  }
  if (miles.fromHome) {
    const out = miles.fromHome[order[0]];
    const back = miles.fromHome[order[order.length - 1]];
    if (out == null || back == null) return null;
    total += out + back;
  }
  return total;
}

/**
 * Drops anything in the model's answer that doesn't fit the route: notes for unknown stops,
 * suggested orders that skip or repeat stops, don't change anything, or add too much driving.
 */
export function sanitizeRouteBrief(
  response: RouteBriefResponse,
  stopCount: number,
  miles?: RouteBriefAgentInput["miles"],
): RouteBrief {
  const headline = response.headline.trim();
  if (!headline) throw new Error("The weather brief came back empty");

  const seen = new Set<number>();
  const siteNotes = response.siteNotes
    .map((siteNote) => ({ stopIndex: siteNote.stopIndex, note: siteNote.note.trim() }))
    .filter(({ stopIndex, note }) => {
      if (!note || !Number.isInteger(stopIndex) || stopIndex < 0 || stopIndex >= stopCount) {
        return false;
      }
      if (seen.has(stopIndex)) return false;
      seen.add(stopIndex);
      return true;
    });

  let suggestion: RouteBrief["suggestion"] = null;
  const proposed = response.suggestion;
  if (
    proposed &&
    stopCount >= 2 &&
    proposed.reason.trim() &&
    isPermutation(proposed.order, stopCount) &&
    proposed.order.some((stopIndex, position) => stopIndex !== position)
  ) {
    const currentOrder = Array.from({ length: stopCount }, (_, index) => index);
    const currentMiles = miles ? routeMiles(currentOrder, miles) : null;
    const proposedMiles = miles ? routeMiles(proposed.order, miles) : null;
    const isTooFar =
      currentMiles !== null &&
      proposedMiles !== null &&
      proposedMiles - currentMiles > MAX_EXTRA_STRAIGHT_MILES;

    if (!isTooFar) suggestion = { order: proposed.order, reason: proposed.reason.trim() };
  }

  return { headline, severity: response.severity, siteNotes, suggestion };
}

export interface RouteBriefResult extends RouteBrief {
  ms: number;
  usage?: { input?: number; output?: number; thoughts?: number };
}

export async function requestRouteBrief(
  ai: GoogleGenAI,
  input: RouteBriefAgentInput,
  options: { model?: string; thinkingLevel?: ThinkingLevel } = {},
): Promise<RouteBriefResult> {
  const start = Date.now();
  const result = await ai.models.generateContent({
    model: options.model ?? ROUTE_BRIEF_MODEL,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema,
      thinkingConfig: { thinkingLevel: options.thinkingLevel ?? VOICE_THINKING },
    },
    contents: [{ role: "user", parts: [{ text: buildRouteBriefPrompt(input) }] }],
  });

  const text = result.text ?? "";
  let parsed: RouteBriefResponse;
  try {
    parsed = routeBriefResponseSchema.parse(JSON.parse(text));
  } catch (error) {
    console.error("Failed to parse route brief JSON:", text, error);
    throw new Error("Couldn't read the weather brief. Please try again.");
  }

  return {
    ...sanitizeRouteBrief(parsed, input.stops.length, input.miles),
    ms: Date.now() - start,
    usage: {
      input: result.usageMetadata?.promptTokenCount,
      output: result.usageMetadata?.candidatesTokenCount,
      thoughts: result.usageMetadata?.thoughtsTokenCount,
    },
  };
}
