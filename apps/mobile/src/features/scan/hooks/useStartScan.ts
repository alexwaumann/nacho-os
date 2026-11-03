import { useState } from "react";

import { getImage } from "../lib/getImage";
import { openScanSheet } from "../lib/pendingScan";
import type { ScanKind } from "../lib/pendingScan";

const TITLES: Record<ScanKind, string> = {
  receipt: "Add a receipt",
  check: "Add a check",
};

/**
 * Start scanning a receipt or check: ask where the photo comes from, get it, then open the sheet
 * that reads it and saves it to a job. `isPicking` is true while the scanner, camera or photo
 * picker is up.
 */
export function useStartScan(kind: ScanKind) {
  const [isPicking, setIsPicking] = useState(false);

  const start = async () => {
    if (isPicking) return;
    setIsPicking(true);
    try {
      const image = await getImage(TITLES[kind]);
      if (image) openScanSheet(kind, image);
    } finally {
      setIsPicking(false);
    }
  };

  return { start, isPicking };
}
