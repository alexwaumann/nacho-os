/**
 * His app settings, the same on the web and in the iOS app.
 */

/** Light, dark, or follow the phone's setting */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCES: ReadonlyArray<ThemePreference> = ["light", "system", "dark"];

/** A stored theme choice, or "system" when there is none or it isn't one we know */
export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** "Read replies out loud" is on unless he turned it off (no setting yet means on) */
export function isReadingRepliesAloud(
  settings: { readRepliesAloud?: boolean } | null | undefined,
): boolean {
  return settings?.readRepliesAloud !== false;
}
