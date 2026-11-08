import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import type { AddJobRow } from "@shared/jobs/addJobQueue";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { ActionButton } from "@/features/job-detail/components/SheetParts";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

interface QueueRowProps {
  row: AddJobRow;
  /** The first page, when the pictures are on this phone */
  thumbnailUri?: string;
  onOpen: (row: Extract<AddJobRow, { kind: "done" }>) => void;
  onRetry: (row: AddJobRow) => Promise<void>;
  onDismiss: (row: AddJobRow) => Promise<void>;
}

const STATUS_TEXT = {
  uploading: "Sending…",
  processing: "Reading the details…",
} as const;

/** One work order in the "Reading work orders" list */
export function QueueRow({ row, thumbnailUri, onOpen, onRetry, onDismiss }: QueueRowProps) {
  const { colors } = useTheme();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry(row);
    setIsRetrying(false);
  };

  const icon =
    row.kind === "done" ?
      <SymbolView name="checkmark.circle.fill" size={24} tintColor={colors.success} />
    : row.kind === "failed" ?
      <SymbolView name="exclamationmark.triangle.fill" size={24} tintColor={colors.destructive} />
    : <ActivityIndicator size="large" color={colors.primary} />;

  const summary = (
    <View style={styles.summary}>
      {thumbnailUri ?
        <Image
          source={{ uri: thumbnailUri }}
          style={[styles.thumbnail, { borderColor: colors.border }]}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      : null}
      <View style={styles.text}>
        <Text variant="label" numberOfLines={3}>
          {row.kind === "done" ? row.address : row.name}
        </Text>
        <Text variant="caption" tone={row.kind === "failed" ? "destructive" : "muted"}>
          {row.kind === "done" ?
            "Job added. Tap to open it."
          : row.kind === "failed" ?
            row.error
          : STATUS_TEXT[row.kind]}
        </Text>
      </View>
      <View style={styles.icon}>{icon}</View>
    </View>
  );

  if (row.kind === "done") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Job added: ${row.address}. Open it.`}
        onPress={() => onOpen(row)}
        style={({ pressed }) => pressed && { opacity: 0.7 }}
      >
        <Card style={{ borderColor: colors.success }}>{summary}</Card>
      </Pressable>
    );
  }

  return (
    <Card
      style={row.kind === "failed" && { borderColor: colors.destructive }}
      accessible={row.kind !== "failed"}
      accessibilityLabel={
        row.kind === "failed" ? undefined : `${row.name}. ${STATUS_TEXT[row.kind]}`
      }
    >
      {summary}
      {row.kind === "failed" ?
        <View style={styles.actions}>
          {row.submissionId ?
            <ActionButton
              title="Try again"
              icon="arrow.clockwise"
              variant="primary"
              isLoading={isRetrying}
              onPress={handleRetry}
            />
          : null}
          <ActionButton
            title="Remove"
            icon="xmark"
            variant="outline"
            disabled={isRetrying}
            onPress={() => void onDismiss(row)}
          />
        </View>
      : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: space.md },
  thumbnail: { width: 64, height: 64, borderRadius: radius.sm, borderWidth: 1 },
  text: { flex: 1, gap: space.xs },
  icon: { width: 36, alignItems: "center" },
  actions: { gap: space.sm, marginTop: space.sm },
});
