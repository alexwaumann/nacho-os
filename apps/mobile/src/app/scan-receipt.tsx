import { ReceiptScanSheet } from "@/features/receipts/components/ReceiptScanSheet";

/**
 * Read a receipt and save it to a job, as a page sheet over the tabs. Open it with
 * `useScanReceipt().start()` from `@/features/receipts/hooks/useScanReceipt`.
 */
export default function ScanReceiptScreen() {
  return <ReceiptScanSheet />;
}
