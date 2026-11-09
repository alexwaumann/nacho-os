import { Link, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import type { AccessibilityActionEvent } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import { getDueBadge } from "@shared/jobs/dueDate";
import {
  formatDueDate,
  getJobProgressStatus,
  getTaskProgress,
  isNewJob,
  jobProgressStatusLabel,
} from "@shared/jobs/jobsList";
import { Card } from "@/components/ui/card";
import { SwipeableRow, useSwipeColors } from "@/components/ui/swipeable-row";
import type { SwipeAction } from "@/components/ui/swipeable-row";
import { Text } from "@/components/ui/text";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

import { getNextStatusAction } from "../hooks/useJobActions";
import type { JobActions } from "../hooks/useJobActions";
import { getDueTodayColor, getStatusChipColors, statusSymbol, withAlpha } from "../lib/jobColors";
import { JobChip as Chip } from "./JobChip";
import { getJobPreviewHeight, JobPreview } from "./JobPreview";

interface JobCardProps {
  job: Doc<"jobs">;
  /** From useJobActions: route toggle, status change, directions, delete */
  actions: JobActions;
}

const createdDateFormat: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/**
 * One job in the Jobs list: address, due and status badges, summary, task progress and weather,
 * like the web card. Tap opens the job. Swipe right to add it to today (or take it off), swipe
 * left to mark it done (or paid). Touch and hold for a preview and a menu with the same actions,
 * Directions and Delete.
 */
export function JobCard({ job, actions }: JobCardProps) {
  const { scheme, colors } = useTheme();
  const router = useRouter();
  const swipeColors = useSwipeColors();
  const { fontScale } = useWindowDimensions();

  const { done, total } = getTaskProgress(job);
  const status = getJobProgressStatus(job);
  const statusColors = getStatusChipColors(status, scheme, colors);
  // Only open work can be late
  const now = new Date();
  const dueBadge = job.status === "pending" ? getDueBadge(job.dueDate, now) : null;
  const isNew = isNewJob(job._creationTime, now.getTime());
  const createdDate = new Date(job._creationTime).toLocaleDateString(undefined, createdDateFormat);
  const isPending = job.status === "pending";
  // Done jobs can still be taken off the route, but not added
  const canToggleRoute = isPending || job.selectedForRoute;
  const routeTitle = job.selectedForRoute ? "Remove from today" : "Add to today";
  const nextStatus = getNextStatusAction(job.status);

  const handleOpen = () => {
    router.push({ pathname: "/job/[id]", params: { id: job._id } });
  };

  const handleToggleRoute = () => void actions.toggleRoute(job);
  const handleNextStatus = () => {
    if (nextStatus) void actions.setStatus(job, nextStatus.status);
  };
  const handleDirections = () => actions.openDirections(job);
  const handleDelete = () => actions.deleteJob(job);

  const routeAction: SwipeAction | null =
    canToggleRoute ?
      {
        label: routeTitle,
        icon: job.selectedForRoute ? "minus.circle.fill" : "plus.circle.fill",
        color: job.selectedForRoute ? swipeColors.neutral : swipeColors.primary,
        accessibilityLabel: `${routeTitle}: ${job.address}`,
        onPress: handleToggleRoute,
      }
    : null;
  const statusAction: SwipeAction | null =
    nextStatus ?
      {
        label: nextStatus.label,
        icon: nextStatus.icon,
        color: swipeColors.success,
        accessibilityLabel: `${nextStatus.title}: ${job.address}`,
        onPress: handleNextStatus,
      }
    : null;

  // VoiceOver can't swipe or long-press, so the same actions are in its actions rotor
  const accessibilityActions = [
    { name: "activate", label: "Open job" },
    ...(canToggleRoute ? [{ name: "route", label: routeTitle }] : []),
    ...(nextStatus ? [{ name: "status", label: nextStatus.title }] : []),
    { name: "directions", label: "Directions" },
    { name: "delete", label: "Delete job" },
  ];

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case "activate":
        return handleOpen();
      case "route":
        return handleToggleRoute();
      case "status":
        return handleNextStatus();
      case "directions":
        return handleDirections();
      case "delete":
        return handleDelete();
    }
  };

  const accessibilityLabel = [
    job.address,
    dueBadge === "overdue" ? "Overdue"
    : dueBadge === "today" ? "Due today"
    : null,
    jobProgressStatusLabel[status],
    job.dueDate ? `Due ${formatDueDate(job.dueDate)}` : null,
    total > 0 ? `${done} of ${total} tasks done` : null,
    job.selectedForRoute ? "On today's route" : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <SwipeableRow leftAction={routeAction} rightAction={statusAction}>
      <Link href={{ pathname: "/job/[id]", params: { id: job._id } }} asChild>
        <Link.Trigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint="Opens the job. Touch and hold for more."
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={handleAccessibilityAction}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Card style={styles.card}>
              <Text variant="heading">{job.address}</Text>

              <View style={styles.chips}>
                {dueBadge === "overdue" ?
                  <Chip
                    label="Overdue"
                    background={colors.destructive}
                    text={colors.destructiveForeground}
                    isStrong
                  />
                : null}
                {dueBadge === "today" ?
                  <Chip
                    label="Due today"
                    background={getDueTodayColor(scheme)}
                    text={scheme === "dark" ? "#030712" : "#ffffff"}
                    isStrong
                  />
                : null}
                {isNew ?
                  <Chip
                    label="New"
                    background={colors.primary}
                    text={colors.primaryForeground}
                    isStrong
                  />
                : null}
                <Chip
                  label={jobProgressStatusLabel[status]}
                  icon={statusSymbol[status]}
                  background={statusColors.background}
                  text={statusColors.text}
                />
                {job.dueDate ?
                  <Chip
                    label={`Due ${formatDueDate(job.dueDate)}`}
                    icon="clock"
                    background={
                      dueBadge === "overdue" ? withAlpha(colors.destructive, 0.14) : colors.muted
                    }
                    text={dueBadge === "overdue" ? colors.destructive : colors.foreground}
                  />
                : null}
                <Chip
                  label={`Added ${createdDate}`}
                  icon="calendar"
                  background={colors.muted}
                  text={colors.mutedForeground}
                />
              </View>

              {job.summary ?
                <Text tone="muted" numberOfLines={2}>
                  {job.summary}
                </Text>
              : null}

              {total > 0 ?
                <View style={styles.progress}>
                  <Text variant="caption" tone="muted">
                    {done} of {total} tasks done
                  </Text>
                  <View style={[styles.track, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${Math.round((done / total) * 100)}%`,
                          backgroundColor: done === total ? colors.success : colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              : null}

              {job.weather ?
                <Text variant="caption" tone="muted">
                  {job.weather.condition}, {job.weather.tempMax}°F
                  {job.weather.precipProb > 20 ?
                    <Text variant="caption" tone="primary">
                      {`, ${job.weather.precipProb}% rain`}
                    </Text>
                  : null}
                </Text>
              : null}

              {isPending ?
                <RouteButton isOnRoute={job.selectedForRoute} onPress={handleToggleRoute} />
              : null}
            </Card>
          </Pressable>
        </Link.Trigger>

        {/* Tapping the preview opens the job */}
        <Link.Preview style={{ height: getJobPreviewHeight(job, fontScale) }}>
          <JobPreview job={job} />
        </Link.Preview>

        <Link.Menu>
          <Link.MenuAction icon="arrow.triangle.turn.up.right.diamond" onPress={handleDirections}>
            Directions
          </Link.MenuAction>
          <Link.MenuAction
            icon={job.selectedForRoute ? "minus.circle" : "plus.circle"}
            onPress={handleToggleRoute}
            hidden={!canToggleRoute}
          >
            {routeTitle}
          </Link.MenuAction>
          <Link.MenuAction
            icon={nextStatus?.icon ?? "checkmark.circle"}
            onPress={handleNextStatus}
            hidden={!nextStatus}
          >
            {nextStatus?.title ?? "Mark done"}
          </Link.MenuAction>
          <Link.Menu inline>
            <Link.MenuAction icon="trash" destructive onPress={handleDelete}>
              Delete job
            </Link.MenuAction>
          </Link.Menu>
        </Link.Menu>
      </Link>
    </SwipeableRow>
  );
}

interface RouteButtonProps {
  isOnRoute: boolean;
  onPress: () => void;
}

/** "Add to today" / "On today's route" toggle, like the route button on the web card */
function RouteButton({ isOnRoute, onPress }: RouteButtonProps) {
  const { colors } = useTheme();
  const iconSize = useScaledSize(20);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isOnRoute }}
      accessibilityLabel={isOnRoute ? "On today's route. Tap to take it off" : "Add to today"}
      onPress={onPress}
      style={({ pressed }) => [
        styles.routeButton,
        isOnRoute ?
          { backgroundColor: colors.primary, borderColor: colors.primary }
        : { backgroundColor: "transparent", borderColor: colors.border },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <SymbolView
        name={isOnRoute ? "checkmark.circle.fill" : "plus.circle"}
        size={iconSize}
        weight="semibold"
        tintColor={isOnRoute ? colors.primaryForeground : colors.primary}
      />
      <Text variant="label" tone={isOnRoute ? "onPrimary" : "primary"}>
        {isOnRoute ? "On today's route" : "Add to today"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  progress: { gap: space.xs },
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  routeButton: {
    minHeight: minTapSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
});
