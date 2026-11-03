import { SymbolView } from "expo-symbols";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { AccessibilityActionEvent } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import type { Doc } from "@convex/_generated/dataModel";
import { formatDriveTime } from "@shared/jobs/today";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

import { getTodayColors } from "../lib/todayColors";
import { ActionButton } from "./ActionButton";
import { HourlyForecastStrip } from "./HourlyForecastStrip";

// How far the card slides to show "Remove" behind it
const REMOVE_ACTION_WIDTH = 132;

interface RouteStopCardProps {
  job: Doc<"jobs">;
  stopNumber: number;
  isDone: boolean;
  /** Estimated arrival (ms), highlighted in the forecast */
  arrivalTime?: number;
  /** One line from today's weather brief about this stop */
  weatherNote?: string;
  /** True while this card is being dragged to a new place */
  isDragging?: boolean;
  onOpen: () => void;
  onDirections: () => void;
  onRemove: () => void;
  /** Starts a drag (from react-native-draggable-flatlist) */
  onDrag: () => void;
  /** For VoiceOver, which can't drag; undefined when the stop can't move that way */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/**
 * A stop on today's route: tap to open the job, hold and drag to move it, swipe left to take it
 * off the route. Shows the drive there, the weather when he arrives, codes and task progress.
 */
export function RouteStopCard({
  job,
  stopNumber,
  isDone,
  arrivalTime,
  weatherNote,
  isDragging = false,
  onOpen,
  onDirections,
  onRemove,
  onDrag,
  onMoveUp,
  onMoveDown,
}: RouteStopCardProps) {
  const { scheme, colors } = useTheme();
  const today = getTodayColors(scheme);
  const swipeableRef = useRef<SwipeableMethods>(null);

  const totalTasks = job.tasks?.length ?? 0;
  const doneTasks = job.tasks?.filter((task) => task.completed).length ?? 0;
  const progress = totalTasks > 0 ? doneTasks / totalTasks : 0;
  const driveTime = formatDriveTime(job.travelTimeValue);
  const accessCodes = job.accessCodes ?? [];
  const status =
    isDone ? "Done"
    : totalTasks > 0 ? `${doneTasks} of ${totalTasks} tasks done`
    : "No tasks";

  const handleRemove = () => {
    swipeableRef.current?.close();
    onRemove();
  };

  const accessibilityActions = [
    { name: "activate", label: "Open job" },
    { name: "directions", label: "Directions" },
    { name: "remove", label: "Remove from route" },
    ...(onMoveUp ? [{ name: "moveUp", label: "Move up" }] : []),
    ...(onMoveDown ? [{ name: "moveDown", label: "Move down" }] : []),
  ];

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case "activate":
        return onOpen();
      case "directions":
        return onDirections();
      case "remove":
        return onRemove();
      case "moveUp":
        return onMoveUp?.();
      case "moveDown":
        return onMoveDown?.();
    }
  };

  const renderRemoveAction = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${job.address} from today's route`}
      onPress={handleRemove}
      style={({ pressed }) => [
        styles.removeAction,
        { backgroundColor: today.removeBackground, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <SymbolView name="minus.circle.fill" size={32} tintColor="#ffffff" />
      <Text variant="label" style={styles.removeLabel} maxFontSizeMultiplier={1.3}>
        Remove
      </Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={1.5}
      rightThreshold={REMOVE_ACTION_WIDTH / 2}
      overshootRight={false}
      enabled={!isDragging}
      renderRightActions={renderRemoveAction}
      containerStyle={styles.swipeContainer}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Stop ${stopNumber}, ${job.address}. ${status}`}
        accessibilityHint="Opens the job. Swipe left to remove it from today's route."
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
        onPress={onOpen}
        onLongPress={onDrag}
        delayLongPress={300}
        disabled={isDragging}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isDragging ? colors.primary : colors.border,
            opacity: pressed && !isDragging ? 0.85 : 1,
          },
          isDragging && styles.dragging,
        ]}
      >
        <View style={styles.header}>
          <View
            style={[styles.badge, { backgroundColor: isDone ? colors.success : colors.primary }]}
          >
            {isDone ?
              <SymbolView
                name="checkmark"
                size={20}
                weight="heavy"
                tintColor={colors.primaryForeground}
              />
            : <Text variant="label" tone="onPrimary" maxFontSizeMultiplier={1.4}>
                {stopNumber}
              </Text>
            }
          </View>
          <Text variant="heading" style={[styles.address, isDone && styles.doneText]}>
            {job.address}
          </Text>
          <SymbolView name="line.3.horizontal" size={22} tintColor={colors.mutedForeground} />
        </View>

        {accessCodes.length > 0 ?
          <View style={styles.codes} accessibilityLabel={`Codes: ${accessCodes.join(", ")}`}>
            {accessCodes.map((code) => (
              <View
                key={code}
                style={[styles.code, { backgroundColor: colors.muted, borderColor: colors.border }]}
              >
                <SymbolView name="key.fill" size={18} tintColor={colors.mutedForeground} />
                <Text variant="label" style={styles.codeText}>
                  {code}
                </Text>
              </View>
            ))}
          </View>
        : null}

        {driveTime ?
          <View style={styles.inline}>
            <SymbolView name="car.fill" size={20} tintColor={colors.mutedForeground} />
            <Text variant="label">{driveTime}</Text>
          </View>
        : null}

        {isDone ? null : (
          <HourlyForecastStrip
            coordinates={job.coordinates}
            arrivalTime={arrivalTime}
            arrivalLabel="You get there around"
          />
        )}

        {weatherNote && !isDone ?
          <View style={styles.inline}>
            <SymbolView name="exclamationmark.triangle.fill" size={20} tintColor={today.warning} />
            <Text variant="body" style={[styles.flex, { color: today.warning }]}>
              {weatherNote}
            </Text>
          </View>
        : null}

        {totalTasks > 0 ?
          <View style={styles.progressRow}>
            <View style={[styles.track, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: isDone ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
            <Text variant="label" tone="muted">
              {doneTasks}/{totalTasks}
            </Text>
          </View>
        : <Text tone="muted">{status}</Text>}

        {isDone ? null : (
          <ActionButton
            title="Directions"
            icon="arrow.triangle.turn.up.right.diamond.fill"
            accessibilityLabel={`Directions to ${job.address}`}
            onPress={onDirections}
          />
        )}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  swipeContainer: { borderRadius: radius.lg, borderCurve: "continuous" },
  card: {
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: space.lg,
    gap: space.md,
  },
  dragging: {
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  badge: {
    minWidth: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  address: { flex: 1, textTransform: "uppercase" },
  doneText: { opacity: 0.6 },
  codes: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  code: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  codeText: { fontFamily: "Menlo", fontWeight: "800", letterSpacing: 1 },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  track: { flex: 1, height: 10, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  removeAction: {
    width: REMOVE_ACTION_WIDTH,
    minHeight: minTapSize,
    marginLeft: space.sm,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
  removeLabel: { color: "#ffffff" },
});
