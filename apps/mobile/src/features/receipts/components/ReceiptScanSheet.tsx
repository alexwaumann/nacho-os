import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatIsoDate } from "@shared/calendar";
import { formatMoney } from "@shared/jobs/jobSheet";
import { getDefaultReceiptJobId, rankJobsForReceipt } from "@shared/receipts/rankJobs";
import { toScannedReceipt } from "@shared/receipts/scanResult";
import type { ScannedReceipt } from "@shared/receipts/scanResult";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { toast, toastError } from "@/components/ui/toast";
import { useUploadFile } from "@/features/media/hooks/useUploadFile";
import type { MediaFile } from "@/features/media/lib/types";
import { JobPicker } from "@/features/scan/components/JobPicker";
import {
  FooterButtons,
  ReadErrorView,
  ReadingView,
  ScanSheet,
} from "@/features/scan/components/ScanSheet";
import { useReadImage } from "@/features/scan/hooks/useReadImage";
import { useScanSheetImage } from "@/features/scan/hooks/useScanSheetImage";
import { space } from "@/lib/theme";

/** Amber, like the web's receipt icon */
const RECEIPT_COLOR = "#d97706";

/**
 * Read a receipt photo, then save it to the job he picks ("scan first, pick the job second").
 * The /scan-receipt sheet; open it with `useScanReceipt().start()`.
 */
export function ReceiptScanSheet() {
  const { image, pickAnother, isPicking } = useScanSheetImage("receipt");
  const analyzeReceipt = useAction(api.ai.analyzeReceipt);
  const { state, retry } = useReadImage(image, async (data) =>
    toScannedReceipt(await analyzeReceipt({ image: data })),
  );

  const handleCancel = () => router.back();

  if (!image) {
    return (
      <ScanSheet
        title="No receipt"
        icon="receipt"
        iconColor={RECEIPT_COLOR}
        footer={<Button title="Close" variant="secondary" onPress={handleCancel} />}
      >
        <Text tone="muted">{`There's no photo to read. Close this and scan the receipt again.`}</Text>
      </ScanSheet>
    );
  }

  if (state.status === "done") {
    return <ReceiptFound image={image} receipt={state.result} onCancel={handleCancel} />;
  }

  return (
    <ScanSheet
      title={state.status === "reading" ? "Reading the receipt" : "Receipt"}
      icon="receipt"
      iconColor={RECEIPT_COLOR}
      footer={<Button title="Cancel" variant="secondary" onPress={handleCancel} />}
    >
      {state.status === "reading" ?
        <ReadingView image={image} label="Reading the total, store and date…" />
      : <ReadErrorView
          title="Couldn't read the receipt"
          message={state.message}
          image={image}
          onRetry={retry}
          onNewPhoto={() => void pickAnother()}
          isPicking={isPicking}
        />
      }
    </ScanSheet>
  );
}

interface ReceiptFoundProps {
  image: MediaFile;
  receipt: ScannedReceipt;
  onCancel: () => void;
}

/** What was read, and which job to put it on (like the web's ReceiptDetectedModal) */
function ReceiptFound({ image, receipt, onCancel }: ReceiptFoundProps) {
  const { isAuthenticated } = useConvexAuth();
  const jobs = useQuery(api.jobs.list, isAuthenticated ? {} : "skip");
  const createReceipt = useMutation(api.receipts.create);
  const uploadFile = useUploadFile();
  const [pickedJobId, setPickedJobId] = useState<Id<"jobs"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const ranked = rankJobsForReceipt(jobs ?? []);
  const pickerJobs = [...ranked.routeJobs, ...ranked.otherJobs];
  const selectedJobId = pickedJobId ?? getDefaultReceiptJobId(ranked);
  const selectedJob = pickerJobs.find((job) => job._id === selectedJobId);
  const amount = formatMoney(receipt.total);

  const handleSave = async () => {
    if (!selectedJob) return;
    setIsSaving(true);
    try {
      const imageId = await uploadFile(image);
      await createReceipt({
        jobId: selectedJob._id,
        imageId,
        storeName: receipt.storeName,
        storeLocation: receipt.storeLocation,
        summary: receipt.summary,
        total: receipt.total,
        date: receipt.date,
      });
      toast.success(`Receipt saved: ${receipt.storeName} ${amount}`, {
        description: `Added to ${selectedJob.address}`,
      });
      router.back();
    } catch (error) {
      toastError("Couldn't save the receipt", error);
      setIsSaving(false);
    }
  };

  return (
    <ScanSheet
      title="Receipt found"
      icon="receipt"
      iconColor={RECEIPT_COLOR}
      isLocked={isSaving}
      footer={
        <FooterButtons>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onCancel}
            disabled={isSaving}
            style={styles.footerButton}
          />
          <Button
            title="Save"
            onPress={() => void handleSave()}
            disabled={!selectedJob}
            isLoading={isSaving}
            style={styles.footerButton}
            accessibilityHint={selectedJob ? undefined : "Pick a job first"}
          />
        </FooterButtons>
      }
    >
      <Card style={styles.summary}>
        <Text variant="title" style={styles.amount}>
          {amount}
        </Text>
        <Text variant="heading">{receipt.storeName}</Text>
        <Text tone="muted">{formatIsoDate(receipt.date)}</Text>
        {receipt.summary ?
          <Text tone="muted" numberOfLines={3}>
            {receipt.summary}
          </Text>
        : null}
      </Card>

      <Text variant="heading">Which job is this for?</Text>

      {jobs === undefined ?
        <ActivityIndicator size="large" style={styles.loading} />
      : pickerJobs.length === 0 ?
        <Text tone="muted" style={styles.center}>
          No open jobs yet. Add a job first.
        </Text>
      : <JobPicker
          jobs={pickerJobs}
          selectedJobId={selectedJobId}
          onSelect={setPickedJobId}
          getSectionLabel={(job) => (job.selectedForRoute ? "On today's route" : "Other jobs")}
        />
      }
      <View style={styles.bottomSpace} />
    </ScanSheet>
  );
}

const styles = StyleSheet.create({
  summary: { gap: space.xs },
  amount: { fontSize: 36, lineHeight: 42, fontWeight: "900" },
  loading: { paddingVertical: space.xl },
  center: { textAlign: "center", paddingVertical: space.xl },
  footerButton: { flexGrow: 1, flexBasis: 140 },
  bottomSpace: { height: space.sm },
});
