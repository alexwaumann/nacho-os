import type { SFSymbol } from "expo-symbols";

import type { JobProgressStatus } from "@shared/jobs/jobsList";
import type { PinKind } from "@shared/jobs/mapPins";
import type { ColorScheme, ThemeColors } from "@/lib/theme";

// Tailwind colors the web card and map use that aren't in the app palette
const amber = { light: "#d97706", dark: "#fbbf24" } as const; // amber-600 / amber-400
const emerald = { light: "#059669", dark: "#34d399" } as const; // emerald-600 / emerald-400

export interface ChipColors {
  background: string;
  text: string;
}

/** Hex color with an alpha, e.g. withAlpha("#0085c8", 0.1) */
export function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
  return `${hex}${value.toString(16).padStart(2, "0")}`;
}

/** The tinted status chip on a job card (same colors as the web card) */
export function getStatusChipColors(
  status: JobProgressStatus,
  scheme: ColorScheme,
  colors: ThemeColors,
): ChipColors {
  const tint = (color: string) => ({ background: withAlpha(color, 0.14), text: color });
  switch (status) {
    case "paid":
      return tint(emerald[scheme]);
    case "completed":
      return tint(colors.primary);
    case "parts-needed":
      return tint(colors.destructive);
    case "in-progress":
      return tint(amber[scheme]);
    case "pending":
      return { background: colors.muted, text: colors.foreground };
  }
}

export const statusSymbol: Record<JobProgressStatus, SFSymbol> = {
  paid: "dollarsign.circle.fill",
  completed: "checkmark.circle.fill",
  "parts-needed": "exclamationmark.circle.fill",
  "in-progress": "clock.fill",
  pending: "clock",
};

/** The "Due today" badge color */
export function getDueTodayColor(scheme: ColorScheme): string {
  return amber[scheme];
}

export interface PinStyle {
  background: string;
  symbol?: SFSymbol;
}

/**
 * Map pin colors, matching the web map: numbered route stops in the brand color, pending jobs solid
 * slate, completed green with a check, paid faded grey with a $.
 */
export function getPinStyle(kind: PinKind, colors: ThemeColors): PinStyle {
  switch (kind) {
    case "route":
      return { background: colors.primary };
    case "pending":
      return { background: "#475569" }; // slate-600
    case "completed":
      return { background: withAlpha(emerald.light, 0.85), symbol: "checkmark" };
    case "paid":
      return { background: "#94a3b8", symbol: "dollarsign" }; // slate-400
  }
}
