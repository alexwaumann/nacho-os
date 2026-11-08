import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { isPdf } from "@convex/lib/media";
import { formatIsoDate } from "@shared/calendar";
import { formatMoney, getJobMoneySummary } from "@shared/jobs/jobSheet";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { SwipeableRow, useSwipeColors } from "@/components/ui/swipeable-row";
import { Text } from "@/components/ui/text";
import { toast, toastError } from "@/components/ui/toast";
import { AddReceiptButton } from "@/features/receipts/components/AddReceiptButton";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

import { openImageViewer } from "../lib/imageViewer";
import { openPdfViewer } from "../lib/pdfViewer";
import { ActionButton, EmptyNote, WARNING } from "./SheetParts";

type Receipts = FunctionReturnType<typeof api.receipts.listByJob>;
type Payment = FunctionReturnType<typeof api.payments.getByJob>;
type ReceiptQueue = FunctionReturnType<typeof api.receipts.listQueueByJob>;

interface MoneyTabProps {
  job: Doc<"jobs">;
  receipts: Receipts | undefined;
  payment: Payment | undefined;
  receiptQueue: ReceiptQueue | undefined;
}

/** What the job paid and cost: the check, the receipts, and what's left */
export function MoneyTab({ job, receipts, payment, receiptQueue }: MoneyTabProps) {
  const { colors } = useTheme();
  const swipeColors = useSwipeColors();
  const removeReceipt = useMutation(api.receipts.remove);
  const removePayment = useMutation(api.payments.remove);
  const dismissQueueItem = useMutation(api.receipts.dismissQueueItem);
  const summary = getJobMoneySummary(receipts, payment);
  const iconSize = useScaledSize(24);

  // PDF receipts open in the PDF viewer; the rest swipe through together in the image viewer
  const receiptsWithImages = (receipts ?? []).filter(
    (receipt) => receipt.imageUrl && !isPdf(receipt.imageContentType),
  );
  const receiptImages = receiptsWithImages.map((receipt) => ({
    uri: receipt.imageUrl!,
    caption: `${receipt.storeName} · ${formatMoney(receipt.total)}`,
  }));

  const handleDeleteReceipt = (receipt: Receipts[number]) => {
    Alert.alert(
      `Delete the receipt from ${receipt.storeName}?`,
      `${formatMoney(receipt.total)} comes off this job. You can't undo this.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeReceipt({ receiptId: receipt._id });
              toast.success("Receipt deleted");
            } catch (error) {
              toastError("Couldn't delete the receipt", error);
            }
          },
        },
      ],
    );
  };

  const handleDeletePayment = (check: NonNullable<Payment>) => {
    Alert.alert(
      "Delete this check?",
      job.status === "paid" ?
        "The job goes back to not paid. You can't undo this."
      : "You can't undo this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removePayment({ paymentId: check._id });
              toast.success("Check deleted");
            } catch (error) {
              toastError("Couldn't delete the check", error);
            }
          },
        },
      ],
    );
  };

  const handleDismiss = async (queueId: ReceiptQueue[number]["_id"]) => {
    try {
      await dismissQueueItem({ queueId });
    } catch (error) {
      toastError("Couldn't dismiss it", error);
    }
  };

  return (
    <View style={styles.tab}>
      {/* Where the job stands: finished and paid dates */}
      {job.status === "paid" ?
        <StatusBanner
          color={colors.success}
          icon="checkmark.circle.fill"
          title={job.paidOn ? `Paid on ${formatIsoDate(job.paidOn)}` : "Paid"}
          detail={job.completedOn ? `Finished on ${formatIsoDate(job.completedOn)}` : undefined}
        />
      : job.status === "completed" ?
        <StatusBanner
          color={WARNING}
          icon="clock.fill"
          title="Not paid yet"
          detail={job.completedOn ? `Finished on ${formatIsoDate(job.completedOn)}` : undefined}
        />
      : null}

      {/* The totals */}
      <Card style={styles.totals}>
        <TotalRow
          label="Check"
          value={summary.paid === null ? "None yet" : formatMoney(summary.paid)}
        />
        <TotalRow
          label={`Receipts (${summary.receiptCount})`}
          value={summary.spent > 0 ? `− ${formatMoney(summary.spent)}` : formatMoney(0)}
          color={summary.spent > 0 ? colors.destructive : undefined}
        />
        {summary.leftAfterReceipts !== null ?
          <View style={[styles.divider, { borderColor: colors.border }]}>
            <TotalRow
              label="Left after receipts"
              value={formatMoney(summary.leftAfterReceipts)}
              color={summary.leftAfterReceipts >= 0 ? colors.success : colors.destructive}
              isBig
            />
          </View>
        : null}
      </Card>

      <Section title="Payment">
        {payment === undefined ?
          <ActivityIndicator />
        : payment ?
          <Card>
            <Text variant="footnote" tone="muted" style={styles.overline}>
              CHECK FROM
            </Text>
            <Text variant="heading">{payment.payerName || "Unknown"}</Text>
            <View style={styles.amountRow}>
              <Text tone="muted">{formatIsoDate(payment.date)}</Text>
              <Text variant="title" style={{ color: colors.success }}>
                {formatMoney(payment.amount)}
              </Text>
            </View>
            <View style={styles.buttons}>
              {payment.imageUrl ?
                <ActionButton
                  title="View check"
                  icon={isPdf(payment.imageContentType) ? "doc.richtext" : "photo"}
                  style={styles.flex}
                  onPress={() => {
                    const caption = `Check from ${payment.payerName || "Unknown"}`;
                    if (isPdf(payment.imageContentType)) {
                      openPdfViewer({ uri: payment.imageUrl!, title: caption });
                    } else {
                      openImageViewer([{ uri: payment.imageUrl!, caption }]);
                    }
                  }}
                />
              : null}
              <ActionButton
                title="Delete"
                icon="trash"
                variant="destructiveOutline"
                accessibilityLabel="Delete check"
                onPress={() => handleDeletePayment(payment)}
              />
            </View>
          </Card>
        : <EmptyNote>No check scanned yet.</EmptyNote>}
      </Section>

      <Section
        title="Receipts"
        aside={
          <Text variant="label" tone={summary.spent > 0 ? "destructive" : "muted"}>
            {formatMoney(summary.spent)}
          </Text>
        }
      >
        <AddReceiptButton jobId={job._id} />

        {(receiptQueue ?? []).map((item) => (
          <Card key={item._id} style={styles.queueItem}>
            {item.status === "failed" ?
              <SymbolView
                name="exclamationmark.triangle.fill"
                size={iconSize}
                tintColor={colors.destructive}
              />
            : <ActivityIndicator />}
            <View style={styles.grow}>
              <Text variant="label">
                {item.status === "failed" ? "Couldn't read a receipt" : "Reading a receipt…"}
              </Text>
              {item.status === "failed" && item.error ?
                <Text variant="caption" tone="muted" numberOfLines={2}>
                  {item.error}
                </Text>
              : null}
            </View>
            {item.status === "failed" ?
              <ActionButton
                title="Dismiss"
                variant="outline"
                onPress={() => void handleDismiss(item._id)}
              />
            : null}
          </Card>
        ))}

        {receipts === undefined ?
          <ActivityIndicator />
        : receipts.length > 0 ?
          receipts.map((receipt) => (
            // Swipe left to delete (it asks first: a deleted receipt can't come back)
            <SwipeableRow
              key={receipt._id}
              rightAction={{
                label: "Delete",
                icon: "trash.fill",
                color: swipeColors.destructive,
                accessibilityLabel: `Delete ${receipt.storeName} receipt`,
                onPress: () => handleDeleteReceipt(receipt),
              }}
            >
              <Card>
                <View style={styles.amountRow}>
                  <View style={styles.grow}>
                    <Text variant="label">{receipt.storeName}</Text>
                    <Text variant="caption" tone="muted">
                      {formatIsoDate(receipt.date)}
                      {receipt.storeLocation ? ` · ${receipt.storeLocation}` : ""}
                    </Text>
                  </View>
                  <Text variant="heading" tone="destructive">
                    {formatMoney(receipt.total)}
                  </Text>
                </View>
                <View style={styles.buttons}>
                  {receipt.imageUrl ?
                    <ActionButton
                      title="View"
                      icon={isPdf(receipt.imageContentType) ? "doc.richtext" : "photo"}
                      style={styles.flex}
                      accessibilityLabel={`View ${receipt.storeName} receipt`}
                      onPress={() =>
                        isPdf(receipt.imageContentType) ?
                          openPdfViewer({
                            uri: receipt.imageUrl!,
                            title: `${receipt.storeName} · ${formatMoney(receipt.total)}`,
                          })
                        : openImageViewer(
                            receiptImages,
                            receiptsWithImages.findIndex((r) => r._id === receipt._id),
                          )
                      }
                    />
                  : null}
                  <ActionButton
                    title="Delete"
                    icon="trash"
                    variant="destructiveOutline"
                    accessibilityLabel={`Delete ${receipt.storeName} receipt`}
                    onPress={() => handleDeleteReceipt(receipt)}
                  />
                </View>
              </Card>
            </SwipeableRow>
          ))
        : (receiptQueue ?? []).length === 0 ?
          <EmptyNote>No receipts added yet.</EmptyNote>
        : null}
      </Section>
    </View>
  );
}

function StatusBanner({
  color,
  icon,
  title,
  detail,
}: {
  color: string;
  icon: "checkmark.circle.fill" | "clock.fill";
  title: string;
  detail?: string;
}) {
  const iconSize = useScaledSize(24);
  return (
    <View style={[styles.banner, { borderColor: color, backgroundColor: `${color}1A` }]}>
      <View style={styles.bannerTitle}>
        <SymbolView name={icon} size={iconSize} tintColor={color} />
        <Text variant="heading" style={{ color, flexShrink: 1 }}>
          {title}
        </Text>
      </View>
      {detail ?
        <Text tone="muted">{detail}</Text>
      : null}
    </View>
  );
}

function TotalRow({
  label,
  value,
  color,
  isBig,
}: {
  label: string;
  value: string;
  color?: string;
  isBig?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text variant={isBig ? "label" : "body"} style={styles.grow}>
        {label}
      </Text>
      <Text variant={isBig ? "heading" : "label"} style={color ? { color } : undefined}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: space.lg },
  flex: { flex: 1 },
  // Takes the free space but lets the amount or button next to it wrap under it when tight
  grow: { flexGrow: 1, flexShrink: 1 },
  banner: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.xs },
  bannerTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  totals: { gap: space.sm },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.md,
    flexWrap: "wrap",
  },
  divider: { borderTopWidth: 1, paddingTop: space.md },
  overline: { fontWeight: "600", letterSpacing: 0.4 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.md,
    flexWrap: "wrap",
  },
  buttons: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  queueItem: { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" },
});
