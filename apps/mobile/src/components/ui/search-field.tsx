import { SymbolView } from "expo-symbols";
import { StyleSheet, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space, typography } from "@/lib/theme";

export interface SearchFieldProps extends Omit<TextInputProps, "style"> {
  /** Read out by VoiceOver, e.g. "Search jobs by address" */
  accessibilityLabel: string;
}

/**
 * A search box like iOS's: a magnifying glass, the text in the body size, and a clear button
 * while typing. For screens without a header to hold a native search bar (the tabs).
 */
export function SearchField(props: SearchFieldProps) {
  const { colors } = useTheme();
  const iconSize = useScaledSize(17);

  return (
    <View style={[styles.field, { backgroundColor: colors.muted }]}>
      <SymbolView name="magnifyingglass" size={iconSize} tintColor={colors.mutedForeground} />
      <TextInput
        accessibilityRole="search"
        placeholderTextColor={colors.mutedForeground}
        maxFontSizeMultiplier={typography.body.maxScale}
        clearButtonMode="while-editing"
        returnKeyType="search"
        autoCorrect={false}
        // No lineHeight: it pushes single-line input text off-center on iOS
        style={[styles.input, { fontSize: typography.body.fontSize, color: colors.foreground }]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: minTapSize,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.md,
    paddingRight: space.xs,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  input: { flex: 1, alignSelf: "stretch", paddingVertical: space.sm },
});
