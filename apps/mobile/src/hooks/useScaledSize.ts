import { useWindowDimensions } from "react-native";

/**
 * A size (an SF Symbol, an icon circle) that grows with Dynamic Type next to the text it sits
 * by, up to `maxScale` times its default-size value, like iOS scales symbols with text.
 */
export function useScaledSize(size: number, maxScale = 2) {
  const { fontScale } = useWindowDimensions();
  return Math.round(size * Math.min(fontScale, maxScale));
}
