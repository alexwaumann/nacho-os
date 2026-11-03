import { useWindowDimensions } from "react-native";

// From this Dynamic Type scale on, buttons side by side no longer fit, so they stack
const LARGE_TEXT_FONT_SCALE = 1.4;

/** True at the larger accessibility text sizes, where rows of buttons should stack. */
export function useIsLargeText() {
  const { fontScale } = useWindowDimensions();
  return fontScale >= LARGE_TEXT_FONT_SCALE;
}
