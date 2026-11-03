import { useColorScheme } from "react-native";

import { colors } from "@/lib/theme";
import type { ColorScheme, ThemeColors } from "@/lib/theme";

/** The current color scheme and its colors, following the system light/dark setting. */
export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const scheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: colors[scheme] };
}
