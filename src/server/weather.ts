// The weather server functions moved to Convex (convex/weather.ts). These re-exports only remain
// for the route brief (src/server/routeBrief.ts and its client hooks) and go away once it moves to
// Convex too.
export type { Coordinates, WorkdayForecastSlot } from "../../convex/lib/weather";
export { getTodayHourlyForecast } from "../../convex/lib/weather";
