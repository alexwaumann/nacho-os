import { PdfViewer } from "@/features/job-detail/components/PdfViewer";

/**
 * Full-screen PDF viewer, presented over everything (including the job sheet). Open it with
 * `openPdfViewer({ uri, title })` from `@/features/job-detail/lib/pdfViewer`.
 */
export default function PdfViewerScreen() {
  return <PdfViewer />;
}
