import { router } from "expo-router";

export interface ViewerImage {
  uri: string;
  /** Shown at the top, and read by VoiceOver */
  caption?: string;
}

// The images handed to the viewer screen. A module variable instead of route params: storage
// URLs are long, and a page of work-order images would make an enormous URL.
let pending: { images: ViewerImage[]; index: number } = { images: [], index: 0 };

/** Open the full-screen image viewer (the /image-viewer route) at `index` */
export function openImageViewer(images: ViewerImage[], index = 0) {
  if (images.length === 0) return;
  pending = { images, index: Math.min(Math.max(index, 0), images.length - 1) };
  router.push("/image-viewer");
}

/** What the viewer screen should show; read once when it opens */
export function getViewerImages() {
  return pending;
}
