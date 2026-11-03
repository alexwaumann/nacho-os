import { CheckScanSheet } from "@/features/checks/components/CheckScanSheet";

/**
 * Read a check and save it as a job's payment, as a page sheet over the tabs. Open it with
 * `useScanCheck().start()` from `@/features/checks/hooks/useScanCheck`.
 */
export default function ScanCheckScreen() {
  return <CheckScanSheet />;
}
