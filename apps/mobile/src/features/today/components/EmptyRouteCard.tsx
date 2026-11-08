import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { getDueBadge, sortJobsByDueDate } from "@shared/jobs/dueDate";
import { describeDueDate } from "@shared/jobs/dueLabel";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { toast, toastError } from "@/components/ui/toast";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

import { ActionButton } from "./ActionButton";

type Job = Doc<"jobs">;

const SUGGESTION_COUNT = 3;

interface EmptyRouteCardProps {
  onPlanRoute: () => void;
  onOpenJob: (jobId: Id<"jobs">) => void;
}

/** Today with no stops: a big "Plan today's route" button and the jobs due soonest. */
export function EmptyRouteCard({ onPlanRoute, onOpenJob }: EmptyRouteCardProps) {
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const pendingJobs = useQuery(api.jobs.list, isAuthenticated ? { status: "pending" } : "skip");
  const toggleSelectedForRoute = useMutation(api.jobs.toggleSelectedForRoute);
  const [addingJobId, setAddingJobId] = useState<Id<"jobs"> | null>(null);
  const mapSize = useScaledSize(40, 1.5);

  const dueSoonest = sortJobsByDueDate(
    (pendingJobs ?? []).filter((job) => !job.selectedForRoute),
  ).slice(0, SUGGESTION_COUNT);

  const handleAddToRoute = async (job: Job) => {
    setAddingJobId(job._id);
    try {
      await toggleSelectedForRoute({ jobId: job._id, selected: true });
      toast.success("Added to today's route");
    } catch (error) {
      toastError("Couldn't add it to the route", error);
    } finally {
      setAddingJobId(null);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <SymbolView name="map" size={mapSize} tintColor={colors.mutedForeground} />
        <Text variant="heading" style={styles.center}>
          No stops planned for today
        </Text>
        <ActionButton
          title="Plan today's route"
          icon="plus"
          variant="primary"
          onPress={onPlanRoute}
          style={styles.fullWidth}
        />
      </View>

      {dueSoonest.length > 0 ?
        <View style={styles.wrapper}>
          <Text variant="heading">Due soonest</Text>
          {dueSoonest.map((job) => (
            <SuggestedJobRow
              key={job._id}
              job={job}
              isAdding={addingJobId === job._id}
              onOpen={() => onOpenJob(job._id)}
              onAdd={() => handleAddToRoute(job)}
            />
          ))}
        </View>
      : null}
    </View>
  );
}

interface SuggestedJobRowProps {
  job: Job;
  isAdding: boolean;
  onOpen: () => void;
  onAdd: () => void;
}

function SuggestedJobRow({ job, isAdding, onOpen, onAdd }: SuggestedJobRowProps) {
  const now = new Date();
  const dueLabel = describeDueDate(job.dueDate, now);
  const isOverdue = getDueBadge(job.dueDate, now) === "overdue";

  return (
    <Card style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${job.address}${dueLabel ? `. ${dueLabel}` : ""}`}
        accessibilityHint="Opens the job"
        onPress={onOpen}
        style={({ pressed }) => [styles.rowBody, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text variant="label" style={styles.upper}>
          {job.address}
        </Text>
        {dueLabel ?
          <Text tone={isOverdue ? "destructive" : "muted"}>{dueLabel}</Text>
        : null}
      </Pressable>
      <ActionButton title="Add to route" icon="plus" isLoading={isAdding} onPress={onAdd} />
    </Card>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.md },
  empty: {
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.lg,
  },
  center: { textAlign: "center" },
  fullWidth: { alignSelf: "stretch" },
  row: { gap: space.md },
  rowBody: { gap: 2, minHeight: 44, justifyContent: "center" },
  upper: { textTransform: "uppercase" },
});
