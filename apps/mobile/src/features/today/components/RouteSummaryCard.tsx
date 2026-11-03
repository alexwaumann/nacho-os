import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

interface RouteSummaryCardProps {
  totalDistance: string;
  totalDuration: string;
}

/** Today's whole drive: distance and time. */
export function RouteSummaryCard({ totalDistance, totalDuration }: RouteSummaryCardProps) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`Whole route: ${totalDistance}, ${totalDuration} of driving`}
      style={[styles.card, { backgroundColor: colors.primary }]}
    >
      <Stat value={totalDistance} label="Distance" />
      <View style={[styles.divider, { backgroundColor: colors.primaryForeground }]} />
      <Stat value={totalDuration} label="Driving" />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title" tone="onPrimary" style={styles.value}>
        {value}
      </Text>
      <Text variant="caption" tone="onPrimary" style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderCurve: "continuous",
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
  },
  stat: { flex: 1, alignItems: "center", gap: space.xs },
  value: { textAlign: "center", fontWeight: "800" },
  label: { textTransform: "uppercase", letterSpacing: 1.5, fontWeight: "700", opacity: 0.85 },
  divider: { width: StyleSheet.hairlineWidth * 2, alignSelf: "stretch", opacity: 0.3 },
});
