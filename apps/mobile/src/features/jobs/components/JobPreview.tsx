import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import {
  formatDueDate,
  getJobProgressStatus,
  getTaskProgress,
  jobProgressStatusLabel,
} from "@shared/jobs/jobsList";
import { Text } from "@/components/ui/text";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { radius, space, typography } from "@/lib/theme";

import { getStatusChipColors, statusSymbol } from "../lib/jobColors";
import { JobChip } from "./JobChip";

// The open tasks listed in the preview; the rest are counted
const MAX_TASKS = 4;
const SUMMARY_LINES = 3;

/**
 * How tall the preview should be. iOS asks for the size before the preview is drawn, so this adds
 * up the lines it will show at the current text size (an estimate; extra space stays blank).
 */
export function getJobPreviewHeight(job: Doc<"jobs">, fontScale: number) {
  const line = (variant: keyof typeof typography) =>
    typography[variant].lineHeight * Math.min(fontScale, typography[variant].maxScale);
  const { done, total } = getTaskProgress(job);
  const openTasks = Math.min(total - done, MAX_TASKS);
  const hasMoreTasks = total - done > MAX_TASKS;

  let height = space.lg * 2 + line("title2") * 2 + space.md + line("footnote") + 8;
  if (job.summary) height += space.md + line("body") * SUMMARY_LINES;
  if (total > 0) height += space.md + line("caption") + space.xs + 6;
  if (openTasks > 0) height += space.md + openTasks * (line("body") + space.sm);
  if (hasMoreTasks) height += line("caption");
  return Math.round(height);
}

interface JobPreviewProps {
  job: Doc<"jobs">;
}

/**
 * What the long-press preview of a job shows above its menu: the address, where it stands, the
 * summary and the next open tasks. Tapping it opens the job.
 */
export function JobPreview({ job }: JobPreviewProps) {
  const { scheme, colors } = useTheme();
  const iconSize = useScaledSize(17);
  const { done, total } = getTaskProgress(job);
  const status = getJobProgressStatus(job);
  const statusColors = getStatusChipColors(status, scheme, colors);
  const openTasks = (job.tasks ?? []).filter((task) => !task.completed);

  return (
    <View style={[styles.preview, { backgroundColor: colors.card }]}>
      <Text variant="title2" numberOfLines={2}>
        {job.address}
      </Text>

      <View style={styles.chips}>
        <JobChip
          label={jobProgressStatusLabel[status]}
          icon={statusSymbol[status]}
          background={statusColors.background}
          text={statusColors.text}
        />
        {job.dueDate ?
          <JobChip
            label={`Due ${formatDueDate(job.dueDate)}`}
            icon="clock"
            background={colors.muted}
            text={colors.foreground}
          />
        : null}
        {job.selectedForRoute ?
          <JobChip
            label="On today's route"
            icon="car.fill"
            background={colors.primary}
            text={colors.primaryForeground}
          />
        : null}
      </View>

      {job.summary ?
        <Text tone="muted" numberOfLines={SUMMARY_LINES}>
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

      {openTasks.length > 0 ?
        <View style={styles.tasks}>
          {openTasks.slice(0, MAX_TASKS).map((task) => (
            <View key={task.id} style={styles.task}>
              <SymbolView name="circle" size={iconSize} tintColor={colors.mutedForeground} />
              <Text numberOfLines={1} style={styles.taskName}>
                {task.taskName}
              </Text>
            </View>
          ))}
          {openTasks.length > MAX_TASKS ?
            <Text variant="caption" tone="muted">
              and {openTasks.length - MAX_TASKS} more
            </Text>
          : null}
        </View>
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { flex: 1, padding: space.lg, gap: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  progress: { gap: space.xs },
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  tasks: { gap: space.sm },
  task: { flexDirection: "row", alignItems: "center", gap: space.sm },
  taskName: { flex: 1 },
});
