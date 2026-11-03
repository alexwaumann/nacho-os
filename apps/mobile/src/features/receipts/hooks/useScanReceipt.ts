import { useStartScan } from "@/features/scan/hooks/useStartScan";

/**
 * "Scan receipt" (no job chosen yet): `start()` asks for the photo (scan, camera or library),
 * then opens the /scan-receipt sheet that reads it and saves it to the job he picks.
 * `isPicking` is true while the scanner or picker is up.
 */
export function useScanReceipt() {
  return useStartScan("receipt");
}
