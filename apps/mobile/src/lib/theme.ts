// Brand colors and sizes, matching the web app (src/styles.css, converted from oklch to hex).
// Components read them through `useTheme()`, which follows the system light/dark setting.

export const colors = {
  light: {
    background: "#ffffff",
    foreground: "#030712",
    card: "#ffffff",
    primary: "#0085c8",
    primaryForeground: "#f2fafe",
    muted: "#f3f4f6",
    mutedForeground: "#6a7282",
    destructive: "#e7000b",
    destructiveForeground: "#ffffff",
    border: "#e5e7eb",
    success: "#008236",
  },
  dark: {
    background: "#030712",
    foreground: "#f9fafb",
    card: "#101828",
    primary: "#00a4e8",
    primaryForeground: "#0a2e47",
    muted: "#1e2939",
    mutedForeground: "#99a1af",
    destructive: "#ff6467",
    destructiveForeground: "#030712",
    border: "rgba(255, 255, 255, 0.12)",
    success: "#05df72",
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ThemeColors = { [K in keyof (typeof colors)["light"]]: string };

/** Spacing steps in points. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radii in points (web --radius is 14px). */
export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;

/**
 * Text styles. Sizes are the starting size at the default iOS text size and grow with Dynamic
 * Type; `maxScale` caps the growth so the largest accessibility sizes stay usable.
 * Bigger than iOS defaults on purpose: the app is for a user in his 60s.
 */
export const typography = {
  title: { fontSize: 30, lineHeight: 36, fontWeight: "700", maxScale: 1.6 },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: "600", maxScale: 1.8 },
  body: { fontSize: 20, lineHeight: 27, fontWeight: "400", maxScale: 2 },
  label: { fontSize: 20, lineHeight: 25, fontWeight: "600", maxScale: 2 },
  caption: { fontSize: 17, lineHeight: 23, fontWeight: "400", maxScale: 2 },
} as const;

export type TextVariant = keyof typeof typography;

/** Smallest height of anything tappable (Apple's minimum is 44 pt). */
export const minTapSize = 56;
