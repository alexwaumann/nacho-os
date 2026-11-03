import { useStartScan } from "@/features/scan/hooks/useStartScan";

/**
 * "Scan check": `start()` asks for the photo (scan, camera or library), then opens the
 * /scan-check sheet that reads it and saves it as the payment for the job he picks.
 * `isPicking` is true while the scanner or picker is up.
 */
export function useScanCheck() {
  return useStartScan("check");
}
