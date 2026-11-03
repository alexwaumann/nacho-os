import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import { JOB_SHEET_TABS } from "@shared/jobs/jobSheetTab";
import type { JobSheetTab } from "@shared/jobs/jobSheetTab";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

const TAB_LABELS: Record<JobSheetTab, string> = {
  tasks: "Tasks",
  info: "Info",
  money: "Money",
  photos: "Photos",
};

interface SheetTabsProps {
  value: JobSheetTab;
  onChange: (tab: JobSheetTab) => void;
  /** Shown after a tab's name, e.g. the number of photos */
  counts?: Partial<Record<JobSheetTab, number>>;
}

/** A segmented control for the sheet's four tabs, 56 pt tall */
export function SheetTabs({ value, onChange, counts }: SheetTabsProps) {
  const { colors } = useTheme();

  return (
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: colors.muted }]}>
      {JOB_SHEET_TABS.map((tab) => {
        const isActive = tab === value;
        const count = counts?.[tab];
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={count ? `${TAB_LABELS[tab]}, ${count}` : TAB_LABELS[tab]}
            onPress={() => {
              if (isActive) return;
              void Haptics.selectionAsync();
              onChange(tab);
            }}
            style={[styles.tab, isActive && [styles.activeTab, { backgroundColor: colors.card }]]}
          >
            <Text
              variant="label"
              tone={isActive ? "primary" : "muted"}
              style={isActive && styles.activeLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.35}
            >
              {TAB_LABELS[tab]}
              {count ? ` ${count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", padding: space.xs, borderRadius: radius.lg, gap: space.xs },
  tab: {
    flex: 1,
    minHeight: minTapSize,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
  },
  activeTab: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  activeLabel: { fontWeight: "800" },
});
