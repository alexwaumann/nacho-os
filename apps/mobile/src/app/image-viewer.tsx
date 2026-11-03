import { ImageViewer } from "@/features/job-detail/components/ImageViewer";

/**
 * Full-screen image viewer, presented over everything (including the job sheet). Open it with
 * `openImageViewer(images, index)` from `@/features/job-detail/lib/imageViewer`.
 */
export default function ImageViewerScreen() {
  return <ImageViewer />;
}
