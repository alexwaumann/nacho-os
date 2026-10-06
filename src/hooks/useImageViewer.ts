import { useState } from "react";

import type { ImageViewerImage } from "@/components/ImageViewer";

/**
 * State for an <ImageViewer />. Spread `viewerProps` onto the viewer and call
 * `openViewer(images, index)` to show a set of images starting at `index`.
 */
export function useImageViewer() {
  const [state, setState] = useState({
    images: [] as Array<ImageViewerImage>,
    startIndex: 0,
    open: false,
  });

  const openViewer = (images: Array<ImageViewerImage>, startIndex = 0) => {
    setState({ images, startIndex, open: true });
  };

  // Images are kept after closing so they stay visible while the viewer fades out
  const handleOpenChange = (open: boolean) => setState((prev) => ({ ...prev, open }));

  return { openViewer, viewerProps: { ...state, onOpenChange: handleOpenChange } };
}
