import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

import { useIsLargeText } from "../hooks/useIsLargeText";
import type { SFSymbol } from "../lib/symbols";
import { getTodayColors } from "../lib/todayColors";

interface TodayActionsProps {
  onAddJob: () => void;
  onScanReceipt: () => void;
  onScanCheck: () => void;
}

/** The three big buttons at the top of Today: Add Job, Scan receipt, Scan check. */
export function TodayActions({ onAddJob, onScanReceipt, onScanCheck }: TodayActionsProps) {
  const { scheme, colors } = useTheme();
  const today = getTodayColors(scheme);
  const isStacked = useIsLargeText();

  return (
    <View style={[styles.row, isStacked && styles.stacked]}>
      <ActionTile
        icon="plus"
        label="Add Job"
        iconBackground={today.primaryTint}
        iconColor={colors.primary}
        isStacked={isStacked}
        onPress={onAddJob}
      />
      <ActionTile
        icon="receipt"
        label="Scan receipt"
        iconBackground={today.receiptTint}
        iconColor={today.receiptIcon}
        isStacked={isStacked}
        onPress={onScanReceipt}
      />
      <ActionTile
        icon="banknote"
        label="Scan check"
        iconBackground={today.checkTint}
        iconColor={today.checkIcon}
        isStacked={isStacked}
        onPress={onScanCheck}
      />
    </View>
  );
}

interface ActionTileProps {
  icon: SFSymbol;
  label: string;
  iconBackground: string;
  iconColor: string;
  isStacked: boolean;
  onPress: () => void;
}

function ActionTile({
  icon,
  label,
  iconBackground,
  iconColor,
  isStacked,
  onPress,
}: ActionTileProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        isStacked && styles.tileStacked,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: iconBackground }]}>
        <SymbolView name={icon} size={28} tintColor={iconColor} weight="bold" />
      </View>
      <Text
        variant="label"
        style={isStacked ? styles.labelStacked : styles.label}
        numberOfLines={2}
        // Side by side the tiles are narrow; stacked, one line still has to fit
        maxFontSizeMultiplier={isStacked ? 1.6 : 1.3}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md },
  stacked: { flexDirection: "column" },
  tile: {
    flex: 1,
    minHeight: minTapSize * 2,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tileStacked: { flexDirection: "row", justifyContent: "flex-start", minHeight: minTapSize + 16 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { textAlign: "center", fontSize: 17, lineHeight: 21 },
  labelStacked: { flex: 1 },
});
