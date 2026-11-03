import { router } from "expo-router";

export interface ViewerPdf {
  /** A storage URL, or a file:// URI on the phone */
  uri: string;
  /** Shown at the top and used as the file name when shared, e.g. "Work order" */
  title: string;
}

// The PDF handed to the viewer screen, like the image viewer's (storage URLs are long)
let pending: ViewerPdf | null = null;

/** Open a PDF full screen (the /pdf-viewer route), with Share */
export function openPdfViewer(pdf: ViewerPdf) {
  pending = pdf;
  router.push("/pdf-viewer");
}

/** What the viewer screen should show; read once when it opens */
export function getViewerPdf() {
  return pending;
}
