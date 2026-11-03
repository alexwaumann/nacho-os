import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import type { SFSymbol } from "expo-symbols";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Smaller second line, e.g. a count */
  detail?: string;
  icon?: SFSymbol;
  /** Read out instead of the label and detail */
  accessibilityLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/**
 * A row of big segments, like iOS's segmented control but at least 56 pt tall with large text
 * (the native one stays small at large text sizes).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();

  const handlePress = (next: T) => {
    if (next === value) return;
    void Haptics.selectionAsync();
    onChange(next);
  };

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.muted }]}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={
              option.accessibilityLabel ??
              (option.detail ? `${option.label}, ${option.detail}` : option.label)
            }
            onPress={() => handlePress(option.value)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && [styles.selected, { backgroundColor: colors.card }],
              pressed && !isSelected && { opacity: 0.6 },
            ]}
          >
            <View style={styles.labelRow}>
              {option.icon ?
                <SymbolView
                  name={option.icon}
                  size={22}
                  weight="semibold"
                  tintColor={isSelected ? colors.primary : colors.mutedForeground}
                />
              : null}
              <Text
                variant="label"
                tone={isSelected ? "primary" : "muted"}
                maxFontSizeMultiplier={1.5}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {option.label}
              </Text>
            </View>
            {option.detail ?
              <Text
                variant="caption"
                tone={isSelected ? "primary" : "muted"}
                maxFontSizeMultiplier={1.5}
                numberOfLines={1}
              >
                {option.detail}
              </Text>
            : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  segment: {
    flex: 1,
    minHeight: minTapSize,
    paddingHorizontal: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
