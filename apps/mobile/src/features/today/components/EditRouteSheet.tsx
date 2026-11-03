import { useConvexAuth, useQuery } from "convex/react";
import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { describeDueDate } from "@shared/jobs/dueLabel";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useRouteOptimization } from "@/features/route/hooks/useRouteOptimization";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

type Job = Doc<"jobs">;
type JobId = Id<"jobs">;

/**
 * Pick today's stops from his open jobs, then plan the fastest order from where he is now
 * (ending at home when it's set). Closes once the route is saved; stays open on a problem so his
 * picks aren't lost.
 */
export function EditRouteSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const pendingJobs = useQuery(api.jobs.list, isAuthenticated ? { status: "pending" } : "skip");
  const { isOptimizing, optimizeAndSaveRoute } = useRouteOptimization();
  // Starts as the jobs already on the route, once they've loaded
  const [picked, setPicked] = useState<Set<JobId> | null>(null);

  const selectedIds =
    picked ??
    new Set((pendingJobs ?? []).filter((job) => job.selectedForRoute).map((job) => job._id));
  const selectedCount = selectedIds.size;

  const handleToggle = (jobId: JobId) => {
    const next = new Set(selectedIds);
    if (next.has(jobId)) next.delete(jobId);
    else next.add(jobId);
    setPicked(next);
  };

  const handleDone = async () => {
    // In list order, like the web app; the optimizer decides the real order
    const ids = (pendingJobs ?? []).map((job) => job._id).filter((id) => selectedIds.has(id));
    const isSaved = await optimizeAndSaveRoute(ids);
    if (isSaved) router.back();
  };

  const doneTitle =
    isOptimizing ? "Planning your route…"
    : selectedCount === 0 ? "Clear today's route"
    : `Plan route with ${selectedCount} stop${selectedCount === 1 ? "" : "s"}`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerText}>
          <Text variant="title">Today&apos;s stops</Text>
          <Text tone={selectedCount === 0 ? "muted" : "primary"} accessibilityLiveRegion="polite">
            {selectedCount === 0 ? "No stops picked" : `${selectedCount} picked`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text variant="label" tone="primary">
            Cancel
          </Text>
        </Pressable>
      </View>

      {pendingJobs === undefined ?
        <ActivityIndicator size="large" style={styles.loading} accessibilityLabel="Loading jobs" />
      : <FlatList
          data={pendingJobs}
          keyExtractor={(job) => job._id}
          extraData={selectedIds}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text tone="muted">Tap the jobs you want to do today.</Text>}
          ListEmptyComponent={
            <Text tone="muted" style={styles.empty}>
              No open jobs. Add a job first.
            </Text>
          }
          renderItem={({ item }) => (
            <PickableJob
              job={item}
              isSelected={selectedIds.has(item._id)}
              onToggle={() => handleToggle(item._id)}
            />
          )}
        />
      }

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, space.lg),
          },
        ]}
      >
        <Button
          title={doneTitle}
          variant={selectedCount === 0 ? "destructive" : "primary"}
          isLoading={isOptimizing}
          disabled={pendingJobs === undefined}
          onPress={() => void handleDone()}
        />
      </View>
    </View>
  );
}

interface PickableJobProps {
  job: Job;
  isSelected: boolean;
  onToggle: () => void;
}

function PickableJob({ job, isSelected, onToggle }: PickableJobProps) {
  const { colors } = useTheme();
  const dueLabel = describeDueDate(job.dueDate, new Date());
  const totalTasks = job.tasks?.length ?? 0;
  const details = [
    dueLabel,
    totalTasks > 0 ? `${totalTasks} task${totalTasks === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${job.address}${details ? `. ${details}` : ""}`}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.job,
        {
          backgroundColor: colors.card,
          borderColor: isSelected ? colors.primary : colors.border,
          borderWidth: isSelected ? 3 : StyleSheet.hairlineWidth * 2,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <SymbolView
        name={isSelected ? "checkmark.circle.fill" : "circle"}
        size={34}
        tintColor={isSelected ? colors.primary : colors.mutedForeground}
      />
      <View style={styles.jobBody}>
        <Text variant="label" style={styles.upper}>
          {job.address}
        </Text>
        {details ?
          <Text tone="muted">{details}</Text>
        : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: space.xs },
  cancel: { minHeight: minTapSize, justifyContent: "center", paddingHorizontal: space.sm },
  loading: { marginTop: space.xxl },
  list: { padding: space.lg, gap: space.md },
  empty: { textAlign: "center", paddingVertical: space.xxl },
  job: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTapSize + 16,
    padding: space.lg,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  jobBody: { flex: 1, gap: space.xs },
  upper: { textTransform: "uppercase" },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
