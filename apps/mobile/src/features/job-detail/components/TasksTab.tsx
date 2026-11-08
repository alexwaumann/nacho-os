import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import {
  formatTaskQuantity,
  getTaskProgress,
  groupTasksByCategory,
  isLastOpenTask,
} from "@shared/jobs/jobSheet";
import type { JobTask } from "@shared/jobs/jobSheet";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

import type { useJobMutations } from "../hooks/useJobMutations";
import { EmptyNote } from "./SheetParts";

const ALL_DONE_TOAST_MS = 15_000;

interface TasksTabProps {
  job: Doc<"jobs">;
  mutations: ReturnType<typeof useJobMutations>;
}

/** The checklist, grouped by kind of work. One tap checks a task off. */
export function TasksTab({ job, mutations }: TasksTabProps) {
  const { colors } = useTheme();
  const progress = getTaskProgress(job.tasks);
  const groups = groupTasksByCategory(job.tasks);
  const allDoneToastId = `all-tasks-done-${job._id}`;

  const handleToggle = async (task: JobTask) => {
    const completed = !task.completed;
    const isFinishing = completed && isLastOpenTask(job.tasks, task.id);
    void Haptics.impactAsync(
      completed ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    if (!completed) toast.dismiss(allDoneToastId);

    const isSaved = await mutations.setTaskDone(task.id, completed);
    if (!isSaved || !isFinishing || job.status !== "pending") return;

    // Checking off the last open task offers a one-tap finish
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.info("All tasks done. Mark the job complete?", {
      id: allDoneToastId,
      duration: ALL_DONE_TOAST_MS,
      action: {
        label: "Yes",
        onPress: () =>
          void mutations.setStatus("completed").then((isDone) => {
            if (isDone) toast.success("Job marked complete");
          }),
      },
    });
  };

  if (progress.total === 0) return <EmptyNote>No tasks on this job.</EmptyNote>;

  return (
    <View style={styles.tab}>
      <View style={styles.progress}>
        <Text variant="heading" accessibilityRole="text">
          {progress.done} of {progress.total} done
        </Text>
        <View
          style={[styles.track, { backgroundColor: colors.muted }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Tasks done"
          accessibilityValue={{ min: 0, max: progress.total, now: progress.done }}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(progress.fraction * 100)}%`,
                backgroundColor: progress.done === progress.total ? colors.success : colors.primary,
              },
            ]}
          />
        </View>
      </View>

      {groups.map((group) => (
        <Section
          key={group.category}
          title={group.category}
          aside={
            <Text variant="caption" tone="muted" style={styles.count}>
              {group.done} of {group.tasks.length}
            </Text>
          }
        >
          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              category={group.category}
              onPress={() => void handleToggle(task)}
            />
          ))}
        </Section>
      ))}
    </View>
  );
}

interface TaskRowProps {
  task: JobTask;
  /** The group heading, so an area that only repeats it ("Interior") isn't shown twice */
  category: string;
  onPress: () => void;
}

function TaskRow({ task, category, onPress }: TaskRowProps) {
  const { colors } = useTheme();
  const quantity = formatTaskQuantity(task);
  const area = task.area?.trim().toLowerCase() === category.toLowerCase() ? null : task.area;
  const details = [area, quantity].filter(Boolean).join(" · ");
  const isDone = task.completed;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isDone }}
      accessibilityLabel={[task.taskName, details].filter(Boolean).join(", ")}
      accessibilityHint={isDone ? "Tap to mark not done" : "Tap to mark done"}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isDone ? colors.muted : colors.card,
          borderColor: isDone ? colors.muted : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rowTop}>
        <View
          style={[
            styles.check,
            isDone ?
              { backgroundColor: colors.success, borderColor: colors.success }
            : { borderColor: colors.mutedForeground },
          ]}
        >
          {isDone ?
            <SymbolView name="checkmark" size={20} weight="bold" tintColor="#fff" />
          : null}
        </View>
        <View style={styles.rowText}>
          <Text variant="label" tone={isDone ? "muted" : "default"} style={isDone && styles.strike}>
            {task.taskName}
          </Text>
          {details ?
            <Text variant="caption" tone="muted">
              {details}
            </Text>
          : null}
          {task.requiresOnlineOrder && !isDone ?
            <Text variant="caption" tone="destructive" style={styles.order}>
              Needs an online order
            </Text>
          : null}
        </View>
      </View>

      {task.sourceItem ?
        <View style={[styles.sheetBox, { backgroundColor: isDone ? colors.card : colors.muted }]}>
          <View style={styles.sheetBoxHeading}>
            <Text
              variant="caption"
              tone="muted"
              style={styles.sheetLabel}
              maxFontSizeMultiplier={1.5}
            >
              ON THE SHEET
            </Text>
            {task.page ?
              <Text
                variant="caption"
                tone="muted"
                style={styles.sheetLabel}
                maxFontSizeMultiplier={1.5}
              >
                PAGE {task.page}
              </Text>
            : null}
          </View>
          <Text variant="caption" tone={isDone ? "muted" : "default"} style={styles.bold}>
            {task.sourceItem}
          </Text>
          {task.specificInstructions ?
            <Text variant="caption" tone="muted">
              {task.specificInstructions}
            </Text>
          : null}
        </View>
      : task.specificInstructions ?
        <Text variant="caption" tone="muted">
          {task.specificInstructions}
        </Text>
      : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { gap: space.xl },
  progress: { gap: space.sm },
  track: { height: 12, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  count: { fontWeight: "700" },
  row: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderCurve: "continuous",
  },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  check: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -2,
  },
  rowText: { flex: 1, gap: space.xs },
  strike: { textDecorationLine: "line-through" },
  order: { fontWeight: "700" },
  sheetBox: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  sheetBoxHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: space.sm,
  },
  sheetLabel: { fontWeight: "800", letterSpacing: 1 },
  bold: { fontWeight: "600" },
});
