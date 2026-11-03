import { StyleSheet, View } from "react-native";
import type { ViewProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

/** A rounded, bordered box for grouping content. */
export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderCurve: "continuous",
    padding: space.lg,
    gap: space.sm,
  },
});
