import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import type { Doc } from "@convex/_generated/dataModel";
import { getDueBadge } from "@shared/jobs/dueDate";
import {
  formatDueDate,
  getJobProgressStatus,
  getTaskProgress,
  jobProgressStatusLabel,
} from "@shared/jobs/jobsList";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { toastError } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { openDirectionsTo } from "@/lib/directions";
import { radius, space } from "@/lib/theme";

// The card sits over the map, so its text grows less than elsewhere to leave some map showing
const TEXT_MAX_SCALE = 1.5;

interface MapJobSummaryProps {
  job: Doc<"jobs">;
  /** Stop number when the job is on today's route */
  routeNumber?: number;
  onClose: () => void;
}

/** The tapped pin's job, over the bottom of the map, with Open and Directions buttons. */
export function MapJobSummary({ job, routeNumber, onClose }: MapJobSummaryProps) {
  const { colors } = useTheme();
  const router = useRouter();
  // Side by side, big text breaks "Directions" mid-word; stack the buttons instead
  const { fontScale } = useWindowDimensions();
  const isStacked = fontScale > 1.3;

  const { done, total } = getTaskProgress(job);
  const dueBadge = job.status === "pending" ? getDueBadge(job.dueDate, new Date()) : null;
  const details = [
    routeNumber !== undefined ? `Stop ${routeNumber} today` : null,
    jobProgressStatusLabel[getJobProgressStatus(job)],
    total > 0 ? `${done} of ${total} tasks done` : null,
  ].filter(Boolean);

  const handleOpen = () => {
    router.push({ pathname: "/job/[id]", params: { id: job._id } });
  };

  const handleDirections = () => {
    openDirectionsTo(job.address).catch((error: unknown) =>
      toastError("Couldn't open Google Maps", error),
    );
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <Text
          variant="heading"
          style={styles.address}
          numberOfLines={3}
          maxFontSizeMultiplier={TEXT_MAX_SCALE}
        >
          {job.address}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={10}
          style={({ pressed }) => [
            styles.close,
            { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <SymbolView name="xmark" size={13} weight="bold" tintColor={colors.mutedForeground} />
        </Pressable>
      </View>

      <Text tone="muted" numberOfLines={2} maxFontSizeMultiplier={TEXT_MAX_SCALE}>
        {details.join(" · ")}
      </Text>
      {job.dueDate ?
        <Text
          tone={dueBadge === "overdue" ? "destructive" : "default"}
          maxFontSizeMultiplier={TEXT_MAX_SCALE}
        >
          {dueBadge === "overdue" ?
            "Overdue: "
          : dueBadge === "today" ?
            "Due today: "
          : "Due "}
          {formatDueDate(job.dueDate)}
        </Text>
      : null}

      <View style={[styles.actions, isStacked && styles.actionsStacked]}>
        <Button title="Open job" onPress={handleOpen} style={!isStacked && styles.actionInRow} />
        <Button
          title="Directions"
          variant="secondary"
          onPress={handleDirections}
          style={!isStacked && styles.actionInRow}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: space.md,
    right: space.md,
    bottom: space.md,
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth * 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  address: { flex: 1 },
  close: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.xs },
  actionsStacked: { flexDirection: "column" },
  actionInRow: { flexGrow: 1, flexBasis: 0 },
});
