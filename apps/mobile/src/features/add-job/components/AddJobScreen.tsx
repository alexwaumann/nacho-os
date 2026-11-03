import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { groupPages } from "@shared/jobs/addJobQueue";
import type { AddJobRow, JobSourceKind } from "@shared/jobs/addJobQueue";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { ActionButton, Section } from "@/features/job-detail/components/SheetParts";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, space } from "@/lib/theme";

import { clearDoneRows, useAddJob } from "../hooks/useAddJob";
import { choosePhotos, PickImagesError, scanPaperwork, takePhoto } from "../lib/pickImages";
import type { PickedImage } from "../lib/pickImages";
import { useSubmissions } from "../lib/submissions";
import { QueueRow } from "./QueueRow";

/** Ask whether several photos are the pages of one work order, or one job each */
function askGrouping(count: number): Promise<"one" | "each" | null> {
  return new Promise((resolve) => {
    Alert.alert("Is this one work order?", `You picked ${count} photos.`, [
      { text: "Yes, one job", onPress: () => resolve("one") },
      { text: `No, ${count} separate jobs`, onPress: () => resolve("each") },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

function showPickError(error: unknown) {
  const message =
    error instanceof PickImagesError ? error.message : "That didn't work. Please try again.";
  if (error instanceof PickImagesError && error.isSettingsError) {
    Alert.alert("Camera is off", message, [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => void Linking.openSettings() },
    ]);
    return;
  }
  toast.error("Couldn't get the pictures", { description: message });
}

/**
 * Add jobs from paperwork: scan it, photograph it or pick photos, and the server reads the job
 * from the pictures. Below, the work orders being read, with the new job when one is done.
 */
export function AddJobScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { rows, submit, retry, dismiss } = useAddJob();
  const submissions = useSubmissions();
  const [activeSource, setActiveSource] = useState<JobSourceKind | null>(null);

  // Forget finished ones when the sheet closes; the job list has them now
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });
  useEffect(() => () => clearDoneRows(rowsRef.current), []);

  const handleSource = async (kind: JobSourceKind) => {
    setActiveSource(kind);
    let pages: PickedImage[] | null;
    try {
      pages =
        kind === "scan" ? await scanPaperwork()
        : kind === "camera" ? await takePhoto()
        : await choosePhotos();
    } catch (error) {
      setActiveSource(null);
      showPickError(error);
      return;
    }
    setActiveSource(null);
    if (!pages || pages.length === 0) return;

    // A scan is one work order; several picked photos might be one or several
    const grouping =
      kind === "library" && pages.length > 1 ? await askGrouping(pages.length) : "one";
    if (!grouping) return;
    await submit(kind, groupPages(pages, grouping));
  };

  const handleOpen = (row: Extract<AddJobRow, { kind: "done" }>) => {
    router.back();
    router.push({ pathname: "/job/[id]", params: { id: row.jobId } });
  };

  const getThumbnail = (row: AddJobRow) =>
    row.submissionId ?
      submissions.find((s) => s.id === row.submissionId)?.pages[0]?.uri
    : undefined;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
    >
      <View style={styles.header}>
        <Text variant="title" style={styles.title}>
          Add jobs
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.done, pressed && { opacity: 0.6 }]}
        >
          <Text variant="label" tone="primary" style={styles.bold}>
            Done
          </Text>
        </Pressable>
      </View>

      <Text tone="muted">Send the work order. The address and tasks are filled in for you.</Text>

      <View style={styles.sources}>
        <ActionButton
          title="Scan paperwork"
          icon="doc.viewfinder"
          variant="primary"
          isLoading={activeSource === "scan"}
          disabled={activeSource !== null}
          onPress={() => void handleSource("scan")}
          style={styles.source}
        />
        <ActionButton
          title="Take a photo"
          icon="camera"
          isLoading={activeSource === "camera"}
          disabled={activeSource !== null}
          onPress={() => void handleSource("camera")}
          style={styles.source}
        />
        <ActionButton
          title="Choose photos"
          icon="photo.on.rectangle"
          isLoading={activeSource === "library"}
          disabled={activeSource !== null}
          onPress={() => void handleSource("library")}
          style={styles.source}
        />
      </View>

      {rows.length > 0 ?
        <Section title="Work orders">
          {rows.map((row) => (
            <QueueRow
              key={row.key}
              row={row}
              thumbnailUri={getThumbnail(row)}
              onOpen={handleOpen}
              onRetry={retry}
              onDismiss={dismiss}
            />
          ))}
        </Section>
      : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, gap: space.lg },
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  title: { flex: 1 },
  done: {
    minHeight: minTapSize,
    minWidth: minTapSize,
    paddingHorizontal: space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  bold: { fontWeight: "800" },
  sources: { gap: space.md },
  source: { minHeight: 64 },
});
