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
 * Text styles: Apple's iOS text styles at the default text size ("Large"), with Apple's line
 * heights. Each grows with Dynamic Type (the iPhone's text size setting) like the iOS style it is
 * named after: `maxScale` stops it where Apple's style stops at the largest accessibility size
 * (AX5), so big titles grow less than body text. Display Zoom and the text size setting do the
 * enlarging; the app itself stays at standard sizes.
 *
 * | Variant      | iOS style    | Size / line | Weight   | Use                                  |
 * | ------------ | ------------ | ----------- | -------- | ------------------------------------ |
 * | `largeTitle` | Large Title  | 34 / 41     | bold     | sign-in                              |
 * | `title`      | Title 1      | 28 / 34     | bold     | sheet titles, amounts                |
 * | `title2`     | Title 2      | 22 / 28     | bold     | the job sheet's address              |
 * | `heading`    | Title 3      | 20 / 25     | semibold | card and section headings            |
 * | `label`      | Headline     | 17 / 22     | semibold | buttons, row titles                  |
 * | `body`       | Body         | 17 / 22     | regular  | text                                 |
 * | `caption`    | Subheadline  | 15 / 20     | regular  | secondary lines under a title        |
 * | `footnote`   | Footnote     | 13 / 18     | regular  | group headings ("STATUS"), small meta |
 *
 * Nothing he has to read is smaller than Footnote (13).
 */
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", maxScale: 60 / 34 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", maxScale: 58 / 28 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", maxScale: 56 / 22 },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: "600", maxScale: 55 / 20 },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "600", maxScale: 53 / 17 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", maxScale: 53 / 17 },
  caption: { fontSize: 15, lineHeight: 20, fontWeight: "400", maxScale: 49 / 15 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", maxScale: 44 / 13 },
} as const;

export type TextVariant = keyof typeof typography;

/** Smallest height (and width) of anything tappable: Apple's 44 pt. */
export const minTapSize = 44;

/** Height of the main buttons (Save, Directions, Add Job …): iOS's large button size. */
export const buttonHeight = 50;

/** SF Symbol sizes in points, matched to the text they sit next to. */
export const iconSize = { sm: 17, md: 22, lg: 28 } as const;
