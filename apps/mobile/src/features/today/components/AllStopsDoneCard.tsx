import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

import { getTodayColors } from "../lib/todayColors";
import { ActionButton } from "./ActionButton";

interface AllStopsDoneCardProps {
  onPlanTomorrow: () => void;
}

/** Shown above the route once every stop on it is done. */
export function AllStopsDoneCard({ onPlanTomorrow }: AllStopsDoneCardProps) {
  const { scheme, colors } = useTheme();
  const today = getTodayColors(scheme);
  const iconSize = useScaledSize(28);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: today.successBackground, borderColor: today.successBorder },
      ]}
    >
      <View style={styles.row}>
        <SymbolView name="checkmark.circle.fill" size={iconSize} tintColor={colors.success} />
        <Text variant="heading" style={styles.flex}>
          All stops done for today
        </Text>
      </View>
      <ActionButton
        title="Plan tomorrow"
        icon="calendar.badge.plus"
        variant="primary"
        onPress={onPlanTomorrow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: 1.5,
    padding: space.lg,
    gap: space.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
});
