import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { Appearance, useColorScheme } from "react-native";

import { parseThemePreference } from "@shared/users/settings";
import type { ThemePreference } from "@shared/users/settings";
import { colors } from "@/lib/theme";
import type { ColorScheme, ThemeColors } from "@/lib/theme";

export type { ThemePreference };

// Kept on the device (like the web's localStorage "nacho-theme"), not in his account
const STORAGE_KEY = "nacho-theme";

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(SecureStore.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn("Reading the theme choice failed:", error);
    return "system";
  }
}

/**
 * Overrides the color scheme for the whole app, native UI included (tab bar, sheets, alerts,
 * status bar), the way iOS does it: by setting the windows' interface style.
 */
function applyPreference(preference: ThemePreference) {
  Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
}

let preference = readStoredPreference();
const listeners = new Set<() => void>();

// Applied as soon as this module loads (the root layout imports it), before the first screen
// draws, so a dark choice doesn't flash light at launch
if (preference !== "system") applyPreference(preference);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Light, dark or follow the phone, saved on this device across launches. */
export function setThemePreference(next: ThemePreference) {
  if (next === preference) return;
  preference = next;
  applyPreference(next);
  try {
    SecureStore.setItem(STORAGE_KEY, next);
  } catch (error) {
    console.warn("Saving the theme choice failed:", error);
  }
  for (const listener of listeners) listener();
}

/** His Light / System / Dark choice and a setter. Use `useTheme()` for the colors. */
export function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
} {
  const current = useSyncExternalStore(subscribe, () => preference);
  return { preference: current, setPreference: setThemePreference };
}

/** The current color scheme and its colors: his Light / Dark choice, or the system setting. */
export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const current = useSyncExternalStore(subscribe, () => preference);
  const systemScheme = useColorScheme();
  // With an override set, useColorScheme already reports it; the choice is checked first anyway
  // so every screen re-renders the moment he picks one
  const scheme: ColorScheme =
    current !== "system" ? current
    : systemScheme === "dark" ? "dark"
    : "light";
  return { scheme, colors: colors[scheme] };
}
