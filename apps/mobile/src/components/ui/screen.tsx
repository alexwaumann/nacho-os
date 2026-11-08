import { ScrollView, StyleSheet } from "react-native";
import type { ScrollViewProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

/**
 * The scrolling page body of a screen. Content insets for the status bar (or header) and the tab
 * bar are automatic. Tab screens have no header: add `<StatusBarScrim />` after it so content
 * doesn't show through the status bar.
 * Screens with text inputs should pass `automaticallyAdjustKeyboardInsets` so the keyboard
 * doesn't cover them.
 */
export function Screen({ contentContainerStyle, style, ...props }: ScrollViewProps) {
  const { colors } = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={[{ backgroundColor: colors.background }, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
});
