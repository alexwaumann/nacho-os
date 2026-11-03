import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { getDefaultJobSheetTab, JOB_SHEET_TABS } from "@shared/jobs/jobSheetTab";
import type { JobSheetTab } from "@shared/jobs/jobSheetTab";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

import { useJobMutations } from "../hooks/useJobMutations";
import { InfoTab } from "./InfoTab";
import { JobHeader } from "./JobHeader";
import { MoneyTab } from "./MoneyTab";
import { PhotosTab } from "./PhotosTab";
import { ActionButton } from "./SheetParts";
import { SheetTabs } from "./SheetTabs";
import { TasksTab } from "./TasksTab";

function isJobSheetTab(value: string | undefined): value is JobSheetTab {
  return JOB_SHEET_TABS.includes(value as JobSheetTab);
}

interface JobDetailSheetProps {
  jobId: Id<"jobs">;
  /** Open on this tab instead of the default for the job (see getDefaultJobSheetTab) */
  initialTab?: string;
}

/**
 * Everything about one job, in a native sheet: header (address, status, Directions, route
 * switch, More menu) and the Tasks / Info / Money / Photos tabs. The tab bar sticks to the top
 * while the tab scrolls.
 */
export function JobDetailSheet({ jobId, initialTab }: JobDetailSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const args = isAuthenticated ? { jobId } : "skip";
  const job = useQuery(api.jobs.get, args);
  const sourceImages = useQuery(api.jobs.getSourceImageUrls, args);
  const receipts = useQuery(api.receipts.listByJob, args);
  const payment = useQuery(api.payments.getByJob, args);
  const receiptQueue = useQuery(api.receipts.listQueueByJob, args);
  const photos = useQuery(api.jobPhotos.listByJob, args);
  const mutations = useJobMutations(jobId);
  const [tab, setTab] = useState<JobSheetTab | null>(isJobSheetTab(initialTab) ? initialTab : null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pick the default tab once, when the job first loads, so it doesn't jump when he changes
  // the status (a completed job defaults to Money)
  if (job && tab === null) setTab(getDefaultJobSheetTab(job));

  const handleDelete = () => {
    Alert.alert(
      "Delete this job?",
      "Its tasks, receipts, check and photos are deleted too. You can't undo this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete job",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            const isDeleted = await mutations.removeJob();
            if (!isDeleted) {
              setIsDeleting(false);
              return;
            }
            toast.success("Job deleted");
            router.back();
          },
        },
      ],
    );
  };

  if (job === undefined || isDeleting) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (job === null) {
    return (
      <View style={[styles.center, styles.missing, { backgroundColor: colors.background }]}>
        <Text variant="heading">This job isn&apos;t here anymore</Text>
        <Text tone="muted">It may have been deleted.</Text>
        <ActionButton title="Close" onPress={() => router.back()} />
      </View>
    );
  }

  const activeTab = tab ?? getDefaultJobSheetTab(job);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl * 3 }]}
      stickyHeaderIndices={[1]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.padded}>
        <JobHeader job={job} mutations={mutations} onDelete={handleDelete} />
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.background }]}>
        <SheetTabs
          value={activeTab}
          onChange={setTab}
          counts={{ photos: photos?.length || undefined }}
        />
      </View>

      <View style={styles.padded}>
        {activeTab === "tasks" ?
          <TasksTab job={job} mutations={mutations} />
        : activeTab === "info" ?
          <InfoTab job={job} sourceImages={sourceImages} mutations={mutations} />
        : activeTab === "money" ?
          <MoneyTab job={job} receipts={receipts} payment={payment} receiptQueue={receiptQueue} />
        : <PhotosTab jobId={jobId} photos={photos} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  missing: { gap: space.md, padding: space.xl },
  content: { paddingTop: space.xl },
  padded: { paddingHorizontal: space.lg },
  tabs: { paddingHorizontal: space.lg, paddingVertical: space.md },
});
