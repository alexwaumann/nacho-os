import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

import type { Coordinates } from "@convex/lib/routing";
import { formatArrivalTime } from "@shared/jobs/arrival";
import { formatDriveTime } from "@shared/jobs/today";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

import { HourlyForecastStrip } from "./HourlyForecastStrip";

interface HomeRouteCardProps {
  homeCoordinates: Coordinates;
  /** Seconds for the drive from the last stop back home, when known */
  driveSeconds?: number;
  /** Estimated arrival (ms) back home, highlighted in the forecast */
  arrivalTime?: number;
}

/**
 * The ride back home, after the last stop. Lined up with the stops but fixed in place: nothing to
 * open, drag or swipe.
 */
export function HomeRouteCard({ homeCoordinates, driveSeconds, arrivalTime }: HomeRouteCardProps) {
  const { colors } = useTheme();
  const driveTime = formatDriveTime(driveSeconds);

  return (
    <View
      accessibilityLabel="Drive home"
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <SymbolView name="house.fill" size={20} tintColor={colors.mutedForeground} />
        </View>
        <Text variant="heading" style={styles.title}>
          Home
        </Text>
      </View>

      {driveTime ?
        <View style={styles.inline}>
          <SymbolView name="car.fill" size={20} tintColor={colors.mutedForeground} />
          <Text variant="label">{driveTime}</Text>
        </View>
      : null}

      <HourlyForecastStrip coordinates={homeCoordinates} arrivalTime={arrivalTime} />

      {arrivalTime !== undefined ?
        <Text variant="label">You get home around {formatArrivalTime(arrivalTime)}</Text>
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: 2,
    borderStyle: "dashed",
    padding: space.lg,
    gap: space.md,
  },
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, textTransform: "uppercase" },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
