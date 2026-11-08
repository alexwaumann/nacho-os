// How pictures are downsized before they're uploaded or read. The iOS app follows these; the web
// app has the same numbers in src/lib/pdf.ts (`compressImage` and the functions that call it), so
// a photo ends up the same size whichever app sent it.

/** What a picture is for; each use has its own size and JPEG quality */
export type ImagePurpose = "workOrder" | "jobPhoto" | "receipt";

export interface ImageResizeSettings {
  /** The longest side, in pixels; smaller pictures keep their size */
  maxSide: number;
  /** JPEG quality, 0-1 */
  quality: number;
}

export const IMAGE_RESIZE: Record<ImagePurpose, ImageResizeSettings> = {
  // Work-order pages and photos (web: processFileToImages -> compressImage defaults). About
  // 150-250 KB a page, so a 10-page work order stays far under Gemini's 20 MB request limit.
  workOrder: { maxSide: 1024, quality: 0.7 },
  // Job-site photos (web: processJobPhoto). Sharp on a phone screen, about 250 KB each.
  jobPhoto: { maxSide: 1280, quality: 0.75 },
  // Receipts and checks (web: processReceiptFile). Bigger and less compressed than the others,
  // so small print (totals, check memos) stays readable for Gemini.
  receipt: { maxSide: 1536, quality: 0.85 },
};

/** The JPEG type every downsized picture is saved as (HEIC, PNG … included) */
export const JPEG_MIME_TYPE = "image/jpeg";

function baseType(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/** Pictures are downsized; PDFs (and anything that isn't a picture) go up unchanged */
export function isDownsizable(mimeType: string | null | undefined): boolean {
  return !!mimeType && baseType(mimeType).startsWith("image/");
}

/**
 * Which file to send once a picture has been downsized: the downsized one, unless the original
 * was already a JPEG no bigger than it (a small picture that re-encoding only made larger).
 * HEIC, PNG and other types always use the downsized JPEG, since not every viewer can show them.
 */
export function chooseUploadVersion({
  originalMimeType,
  originalBytes,
  resizedBytes,
}: {
  originalMimeType: string;
  originalBytes: number | undefined;
  resizedBytes: number | undefined;
}): "original" | "resized" {
  const isJpeg = ["image/jpeg", "image/jpg"].includes(baseType(originalMimeType));
  if (!isJpeg || originalBytes === undefined || resizedBytes === undefined) return "resized";
  return originalBytes <= resizedBytes ? "original" : "resized";
}

/** "312 KB" or "2.1 MB" (1 MB = 1,000,000 bytes, like the Files app), for logs */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
