import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import { isStopDone } from "@shared/jobs/today";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

interface RouteStopCardProps {
  job: Doc<"jobs">;
  stopNumber: number;
}

/** One stop on today's route: its number, address and how many tasks are done. Opens the job. */
export function RouteStopCard({ job, stopNumber }: RouteStopCardProps) {
  const { colors } = useTheme();
  const isDone = isStopDone(job);
  const totalTasks = job.tasks?.length ?? 0;
  const doneTasks = job.tasks?.filter((task) => task.completed).length ?? 0;
  const progress = totalTasks > 0 ? doneTasks / totalTasks : 0;
  const status =
    isDone ? "Done"
    : totalTasks > 0 ? `${doneTasks} of ${totalTasks} tasks done`
    : "No tasks";

  return (
    <Link href={{ pathname: "/job/[id]", params: { id: job._id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Stop ${stopNumber}, ${job.address}. ${status}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Card style={styles.card}>
          <View
            style={[styles.badge, { backgroundColor: isDone ? colors.success : colors.primary }]}
          >
            <Text variant="label" tone="onPrimary" maxFontSizeMultiplier={1.4}>
              {isDone ? "✓" : stopNumber}
            </Text>
          </View>
          <View style={styles.body}>
            <Text variant="heading">{job.address}</Text>
            <Text tone={isDone ? "muted" : "default"}>{status}</Text>
            {totalTasks > 0 ?
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
            : null}
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", gap: space.lg },
  badge: {
    minWidth: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  body: { flex: 1, gap: space.sm },
  track: { height: 8, borderRadius: radius.pill, overflow: "hidden", marginTop: space.xs },
  fill: { height: "100%", borderRadius: radius.pill },
});
