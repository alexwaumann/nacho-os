import { useWindowDimensions } from "react-native";

// From this Dynamic Type scale on (the accessibility sizes, AX1 = 1.43), things side by side no
// longer fit next to each other, so they stack
const LARGE_TEXT_FONT_SCALE = 1.4;

/**
 * True at the accessibility text sizes, where rows should stack: buttons under each other, a
 * switch under its label, an icon above its text.
 */
export function useIsLargeText() {
  const { fontScale } = useWindowDimensions();
  return fontScale >= LARGE_TEXT_FONT_SCALE;
}
