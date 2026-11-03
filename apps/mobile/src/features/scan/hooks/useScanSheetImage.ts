import { useState } from "react";

import { getImage } from "../lib/getImage";
import { getPendingImage } from "../lib/pendingScan";
import type { ScanKind } from "../lib/pendingScan";

/**
 * The photo a scan sheet reads: the one it was opened with, until he picks a different one.
 */
export function useScanSheetImage(kind: ScanKind) {
  const [image, setImage] = useState(() => getPendingImage(kind));
  const [isPicking, setIsPicking] = useState(false);

  const pickAnother = async () => {
    if (isPicking) return;
    setIsPicking(true);
    try {
      const next = await getImage("Use a different photo");
      if (next) setImage(next);
    } finally {
      setIsPicking(false);
    }
  };

  return { image, pickAnother, isPicking };
}
