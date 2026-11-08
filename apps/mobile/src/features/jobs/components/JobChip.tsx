import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useScaledSize } from "@/hooks/useScaledSize";
import { radius, space } from "@/lib/theme";

interface JobChipProps {
  label: string;
  icon?: SFSymbol;
  background: string;
  text: string;
  /** Bold text, for the attention badges (Overdue, Due today, New) */
  isStrong?: boolean;
}

/** A small tinted badge on a job card or its preview: status, due date, Overdue … */
export function JobChip({ label, icon, background, text, isStrong }: JobChipProps) {
  const iconSize = useScaledSize(13);
  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      {icon ?
        <SymbolView name={icon} size={iconSize} weight="semibold" tintColor={text} />
      : null}
      <Text
        variant="footnote"
        style={[styles.chipText, { color: text }, isStrong && styles.strong]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderCurve: "continuous",
  },
  chipText: { fontWeight: "600" },
  strong: { fontWeight: "700" },
});
