import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Shown after the label on the same line, e.g. "Photos 2"; hidden when 0 or missing */
  count?: number;
  /** Smaller second line under the label, e.g. a count */
  detail?: string;
  icon?: SFSymbol;
  /** Read out instead of the label, count and detail */
  accessibilityLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  /** The selected option's value */
  value: T;
  onChange: (value: T) => void;
  /** What the whole control picks, read out by VoiceOver */
  accessibilityLabel?: string;
}

function describe<T extends string>({ label, count, detail }: SegmentOption<T>) {
  return [label, count ? String(count) : undefined, detail].filter(Boolean).join(", ");
}

/**
 * A row of segments, like iOS's segmented control but 44 pt tall with Subheadline text that
 * follows Dynamic Type (the native one stays small at large text sizes). VoiceOver reads it as tabs, one selected.
 *
 * Every segmented control in the app goes through here, so swapping the insides for the native
 * control later (e.g. Expo UI's SwiftUI `Picker`) is a change to this file only.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const iconSize = useScaledSize(17);

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
            accessibilityLabel={option.accessibilityLabel ?? describe(option)}
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
                  size={iconSize}
                  weight="semibold"
                  tintColor={isSelected ? colors.primary : colors.mutedForeground}
                />
              : null}
              <Text
                variant="caption"
                tone={isSelected ? "primary" : "muted"}
                style={styles.label}
                // One line per segment: past this it shrinks to fit instead
                maxFontSizeMultiplier={2}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {option.label}
                {option.count ? ` ${option.count}` : ""}
              </Text>
            </View>
            {option.detail ?
              <Text
                variant="footnote"
                tone={isSelected ? "primary" : "muted"}
                maxFontSizeMultiplier={2}
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
  labelRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  label: { fontWeight: "600" },
});
