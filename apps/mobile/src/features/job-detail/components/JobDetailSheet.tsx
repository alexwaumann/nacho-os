import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { getDefaultJobSheetTab, JOB_SHEET_TABS } from "@shared/jobs/jobSheetTab";
import type { JobSheetTab } from "@shared/jobs/jobSheetTab";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { confirmDeleteJob } from "@/features/jobs/lib/confirmDeleteJob";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

import { useJobMutations } from "../hooks/useJobMutations";
import { InfoTab } from "./InfoTab";
import { JobHeader } from "./JobHeader";
import { MoneyTab } from "./MoneyTab";
import { PhotosTab } from "./PhotosTab";
import { ActionButton } from "./SheetParts";
import { TasksTab } from "./TasksTab";

const TAB_LABELS: Record<JobSheetTab, string> = {
  tasks: "Tasks",
  info: "Info",
  money: "Money",
  photos: "Photos",
};

function isJobSheetTab(value: string | undefined): value is JobSheetTab {
  return JOB_SHEET_TABS.includes(value as JobSheetTab);
}

interface JobDetailSheetProps {
  jobId: Id<"jobs">;
  /**
   * Show this tab instead of the default for the job (see getDefaultJobSheetTab): on open, and
   * again whenever a new one is requested while the sheet is up
   */
  requestedTab?: string;
}

/**
 * Everything about one job, in a native sheet: header (address, status, Directions, route
 * switch, More menu) and the Tasks / Info / Money / Photos tabs. The tab bar sticks to the top
 * while the tab scrolls.
 */
export function JobDetailSheet({ jobId, requestedTab }: JobDetailSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const args = isAuthenticated ? { jobId } : "skip";
  const job = useQuery(api.jobs.get, args);
  const sourceImages = useQuery(api.jobs.getSourceImageUrls, args);
  const sourceFile = useQuery(api.jobs.getSourceFileUrl, args);
  const receipts = useQuery(api.receipts.listByJob, args);
  const payment = useQuery(api.payments.getByJob, args);
  const receiptQueue = useQuery(api.receipts.listQueueByJob, args);
  const photos = useQuery(api.jobPhotos.listByJob, args);
  const mutations = useJobMutations(jobId);
  const [tab, setTab] = useState<JobSheetTab | null>(
    isJobSheetTab(requestedTab) ? requestedTab : null,
  );
  const [lastRequestedTab, setLastRequestedTab] = useState(requestedTab);
  const [isDeleting, setIsDeleting] = useState(false);

  // The same job opened again with a tab (e.g. "show the photos" by voice) switches to it
  if (requestedTab !== lastRequestedTab) {
    setLastRequestedTab(requestedTab);
    if (isJobSheetTab(requestedTab)) setTab(requestedTab);
  }

  // Pick the default tab once, when the job first loads, so it doesn't jump when he changes
  // the status (a completed job defaults to Money)
  if (job && tab === null) setTab(getDefaultJobSheetTab(job));

  const handleDelete = () => {
    confirmDeleteJob(async () => {
      setIsDeleting(true);
      const isDeleted = await mutations.removeJob();
      if (!isDeleted) {
        setIsDeleting(false);
        return;
      }
      toast.success("Job deleted");
      router.back();
    });
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
        <SegmentedControl
          options={JOB_SHEET_TABS.map((value) => ({
            value,
            label: TAB_LABELS[value],
            count: value === "photos" ? photos?.length : undefined,
          }))}
          value={activeTab}
          onChange={setTab}
        />
      </View>

      <View style={styles.padded}>
        {activeTab === "tasks" ?
          <TasksTab job={job} mutations={mutations} />
        : activeTab === "info" ?
          <InfoTab
            job={job}
            sourceImages={sourceImages}
            sourceFile={sourceFile}
            mutations={mutations}
          />
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
  content: { paddingTop: space.lg },
  padded: { paddingHorizontal: space.lg },
  tabs: { paddingHorizontal: space.lg, paddingVertical: space.sm },
});
