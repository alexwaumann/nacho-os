// Pure helpers for deciding when the daily weather brief is (re)generated

/** The brief is only generated on its own between these local hours (4:00 AM to 2:00 PM) */
export const AUTO_BRIEF_START_HOUR = 4;
export const AUTO_BRIEF_END_HOUR = 14;

/** Identifies the SET of route jobs, ignoring their order */
export function buildJobSetKey(jobIds: ReadonlyArray<string>): string {
  return [...jobIds].sort().join(",");
}

/** Identifies the route jobs in their current order */
export function buildOrderKey(jobIds: ReadonlyArray<string>): string {
  return jobIds.join(",");
}

/** Local calendar date as YYYY-MM-DD */
export function toLocalDateKey(time: number): string {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isAutoBriefHour(localHour: number): boolean {
  return localHour >= AUTO_BRIEF_START_HOUR && localHour < AUTO_BRIEF_END_HOUR;
}

export interface StoredBriefKeys {
  jobSetKey: string;
  orderKey: string;
  hasSuggestion: boolean;
}

export interface BriefDecisionInput {
  /** Today's stored brief for this job set, or null when there isn't one */
  stored: StoredBriefKeys | null;
  jobSetKey: string;
  orderKey: string;
  localHour: number;
  /** At least one route job has coordinates, so there's weather to check */
  hasSites: boolean;
}

/**
 * - "generate": no brief for today's set of jobs yet, and it's the time of day to make one
 * - "keep": show the stored brief as it is
 * - "clear-suggestion": same jobs, but the route was reordered, so the suggested order is stale
 * - "none": nothing to show (and nothing to do until the user asks)
 */
export type BriefAction = "generate" | "keep" | "clear-suggestion" | "none";

export function decideBriefAction({
  stored,
  jobSetKey,
  orderKey,
  localHour,
  hasSites,
}: BriefDecisionInput): BriefAction {
  if (!hasSites) return "none";

  if (!stored || stored.jobSetKey !== jobSetKey) {
    return isAutoBriefHour(localHour) ? "generate" : "none";
  }

  if (stored.hasSuggestion && stored.orderKey !== orderKey) return "clear-suggestion";

  return "keep";
}
