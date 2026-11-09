import type { ColorScheme } from "@/lib/theme";

// Extra colors the Today screen needs beyond the app palette (Tailwind's, like the web app)
const palette = {
  light: {
    sun: "#f59e0b",
    moon: "#6366f1",
    cloud: "#64748b",
    rain: "#0284c7",
    snow: "#0ea5e9",
    storm: "#7c3aed",
    warning: "#b45309",
    warningBackground: "#fffbeb",
    warningBorder: "#f59e0b",
    successBackground: "#ecfdf5",
    successBorder: "#6ee7b7",
    primaryTint: "rgba(0, 133, 200, 0.12)",
    receiptTint: "#fef3c7",
    receiptIcon: "#92400e",
    checkTint: "#d1fae5",
    checkIcon: "#065f46",
  },
  dark: {
    sun: "#fbbf24",
    moon: "#a5b4fc",
    cloud: "#94a3b8",
    rain: "#38bdf8",
    snow: "#7dd3fc",
    storm: "#a78bfa",
    warning: "#fbbf24",
    warningBackground: "rgba(120, 53, 15, 0.35)",
    warningBorder: "rgba(245, 158, 11, 0.6)",
    successBackground: "rgba(6, 78, 59, 0.35)",
    successBorder: "rgba(16, 185, 129, 0.5)",
    primaryTint: "rgba(0, 164, 232, 0.18)",
    receiptTint: "rgba(120, 53, 15, 0.5)",
    receiptIcon: "#fef3c7",
    checkTint: "rgba(6, 78, 59, 0.5)",
    checkIcon: "#d1fae5",
  },
} as const;

export type TodayColors = { [K in keyof (typeof palette)["light"]]: string };

export function getTodayColors(scheme: ColorScheme): TodayColors {
  return palette[scheme];
}
