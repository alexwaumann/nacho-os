import { Link, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import type { SFSymbol } from "expo-symbols";

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
import { Text } from "@/components/ui/text";
import { toastError } from "@/components/ui/toast";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { openDirectionsTo } from "@/lib/directions";
import { minTapSize, radius, space } from "@/lib/theme";

import { getDueTodayColor, getStatusChipColors, statusSymbol, withAlpha } from "../lib/jobColors";

interface JobCardProps {
  job: Doc<"jobs">;
  /** Adds the job to today's route or takes it off */
  onToggleRoute: (job: Doc<"jobs">) => void;
}

const createdDateFormat: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/**
 * One job in the Jobs list: address, due and status badges, summary, task progress and weather,
 * like the web card. Tap opens the job; long-press shows Open, Directions and the route toggle.
 */
export function JobCard({ job, onToggleRoute }: JobCardProps) {
  const { scheme, colors } = useTheme();
  const router = useRouter();

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

  const handleOpen = () => {
    router.push({ pathname: "/job/[id]", params: { id: job._id } });
  };

  const handleDirections = () => {
    openDirectionsTo(job.address).catch((error: unknown) =>
      toastError("Couldn't open Google Maps", error),
    );
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
    <Link href={{ pathname: "/job/[id]", params: { id: job._id } }} asChild>
      <Link.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Opens the job. Touch and hold for more."
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
              <RouteButton isOnRoute={job.selectedForRoute} onPress={() => onToggleRoute(job)} />
            : null}
          </Card>
        </Pressable>
      </Link.Trigger>

      <Link.Menu title={job.address}>
        <Link.MenuAction icon="doc.text" onPress={handleOpen}>
          Open job
        </Link.MenuAction>
        <Link.MenuAction icon="car.fill" onPress={handleDirections}>
          Directions
        </Link.MenuAction>
        <Link.MenuAction
          icon={job.selectedForRoute ? "minus.circle" : "plus.circle"}
          onPress={() => onToggleRoute(job)}
          hidden={!canToggleRoute}
        >
          {job.selectedForRoute ? "Take off today's route" : "Add to today's route"}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  );
}

interface ChipProps {
  label: string;
  icon?: SFSymbol;
  background: string;
  text: string;
  /** Bold text, for the attention badges (Overdue, Due today, New) */
  isStrong?: boolean;
}

function Chip({ label, icon, background, text, isStrong }: ChipProps) {
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
