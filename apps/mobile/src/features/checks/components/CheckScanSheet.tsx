import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { rankJobsForCheck, toScannedCheck } from "@shared/checks/scanResult";
import type { ScannedCheck } from "@shared/checks/scanResult";
import { formatMoney } from "@shared/jobs/jobSheet";
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
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

/**
 * Read a check photo, then save it as the payment for the job he picks; the job whose address
 * is in the memo comes first. The /scan-check sheet; open it with `useScanCheck().start()`.
 */
export function CheckScanSheet() {
  const { colors } = useTheme();
  const { image, pickAnother, isPicking } = useScanSheetImage("check");
  const analyzeCheck = useAction(api.ai.analyzeCheck);
  const { state, retry } = useReadImage(image, async (data) =>
    toScannedCheck(await analyzeCheck({ image: data })),
  );

  const handleCancel = () => router.back();

  if (!image) {
    return (
      <ScanSheet
        title="No check"
        icon="banknote"
        iconColor={colors.success}
        footer={<Button title="Close" variant="secondary" onPress={handleCancel} />}
      >
        <Text tone="muted">{`There's no photo to read. Close this and scan the check again.`}</Text>
      </ScanSheet>
    );
  }

  if (state.status === "done") {
    return <CheckFound image={image} check={state.result} onCancel={handleCancel} />;
  }

  return (
    <ScanSheet
      title={state.status === "reading" ? "Reading the check" : "Check"}
      icon="banknote"
      iconColor={colors.success}
      footer={<Button title="Cancel" variant="secondary" onPress={handleCancel} />}
    >
      {state.status === "reading" ?
        <ReadingView image={image} label="Reading the amount and who it's from…" />
      : <ReadErrorView
          title="Couldn't read the check"
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

interface CheckFoundProps {
  image: MediaFile;
  check: ScannedCheck;
  onCancel: () => void;
}

/** What was read, and which unpaid job it pays for (like the web's CheckDetectedModal) */
function CheckFound({ image, check, onCancel }: CheckFoundProps) {
  const { colors } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const unpaidJobs = useQuery(api.jobs.listUnpaid, isAuthenticated ? {} : "skip");
  const createPayment = useMutation(api.payments.create);
  const uploadFile = useUploadFile();
  const [selectedJobId, setSelectedJobId] = useState<Id<"jobs"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Checks usually carry the job address in the memo, so the best match goes first
  const { recommendedJob, jobs: pickerJobs } = rankJobsForCheck(
    check.detectedAddress,
    unpaidJobs ?? [],
  );
  const selectedJob = pickerJobs.find((job) => job._id === selectedJobId);
  const amount = formatMoney(check.amount);

  const handleSave = async () => {
    if (!selectedJob) return;
    setIsSaving(true);
    try {
      const imageId = await uploadFile(image);
      // Also marks the job paid
      await createPayment({
        jobId: selectedJob._id,
        imageId,
        amount: check.amount,
        payerName: check.payerName,
        detectedAddress: check.detectedAddress,
        date: check.date,
      });
      toast.success(`Check saved: ${amount}`, { description: `Added to ${selectedJob.address}` });
      router.back();
    } catch (error) {
      toastError("Couldn't save the check", error);
      setIsSaving(false);
    }
  };

  return (
    <ScanSheet
      title="Check found"
      icon="banknote"
      iconColor={colors.success}
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
        {check.payerName ?
          <Detail label="From" value={check.payerName} />
        : null}
        {check.detectedAddress ?
          <Detail label="Address" value={check.detectedAddress} />
        : null}
      </Card>

      <Text variant="heading">Which job is this for?</Text>

      {unpaidJobs === undefined ?
        <ActivityIndicator size="large" style={styles.loading} />
      : pickerJobs.length === 0 ?
        <Text tone="muted" style={styles.center}>
          No unpaid jobs to put this check on.
        </Text>
      : <JobPicker
          jobs={pickerJobs}
          selectedJobId={selectedJobId}
          onSelect={setSelectedJobId}
          recommendedJobId={recommendedJob?._id}
          getSectionLabel={
            recommendedJob ?
              (job) => (job._id === recommendedJob._id ? undefined : "Other jobs")
            : undefined
          }
        />
      }
      <View style={styles.bottomSpace} />
    </ScanSheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text>
      <Text tone="muted">{label}: </Text>
      <Text variant="label">{value}</Text>
    </Text>
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
