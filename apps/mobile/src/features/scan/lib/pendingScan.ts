import { router } from "expo-router";

import type { CapturedImage } from "./capture";

export type ScanKind = "receipt" | "check";

// The photo handed to the scan sheet. A module variable instead of route params, like the image
// viewer: file URIs are long, and the sheet only needs it once, when it opens.
const pending: Record<ScanKind, CapturedImage | null> = { receipt: null, check: null };

/** Open the receipt or check sheet (`/scan-receipt`, `/scan-check`) to read `image` */
export function openScanSheet(kind: ScanKind, image: CapturedImage) {
  pending[kind] = image;
  router.push(kind === "receipt" ? "/scan-receipt" : "/scan-check");
}

/** The photo the sheet should read; null if the sheet was opened without one */
export function getPendingImage(kind: ScanKind): CapturedImage | null {
  return pending[kind];
}
