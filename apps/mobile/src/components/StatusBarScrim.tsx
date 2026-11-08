import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";

// The fade under the status bar: 1 pt bands easing from solid to clear (no gradient module in
// the build, and 1 pt bands don't show as stripes)
const FADE_HEIGHT = 14;
const FADE_STEPS = Array.from({ length: FADE_HEIGHT }, (_, i) => (1 - (i + 1) / FADE_HEIGHT) ** 2);

/**
 * The page background behind the status bar, fading out below it, so scrolled content doesn't
 * run into the clock and battery. For screens without a header (the tabs' first screens): render
 * it after the scroll view. It doesn't take touches.
 */
export function StatusBarScrim() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="none" style={styles.scrim} accessibilityElementsHidden>
      <View style={{ height: insets.top, backgroundColor: colors.background }} />
      {FADE_STEPS.map((opacity, i) => (
        <View key={i} style={{ height: 1, backgroundColor: colors.background, opacity }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", top: 0, left: 0, right: 0 },
});
