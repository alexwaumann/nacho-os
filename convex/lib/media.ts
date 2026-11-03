import { ConvexError, v } from "convex/values";

// Base64 media sent straight to an action. Node actions take at most 5 MiB of arguments, so
// these leave room for the rest of the request.

/** ~60s of AAC is well under this */
export const MAX_AUDIO_BASE64_LENGTH = 4 * 1024 * 1024;
/** A compressed receipt photo or PDF page is usually well under 1 MB */
export const MAX_IMAGE_BASE64_LENGTH = 4 * 1024 * 1024;
/** The file size (bytes) that fits in MAX_IMAGE_BASE64_LENGTH once base64-encoded: 3 MiB */
export const MAX_IMAGE_BYTES = (MAX_IMAGE_BASE64_LENGTH / 4) * 3;

/**
 * Largest stored document (a work-order PDF or photo, a receipt) read from storage and sent to
 * Gemini inline. Keeps the request well under Gemini's 20 MB limit.
 */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export const PDF_MIME_TYPE = "application/pdf";

export const mediaValidator = v.object({ base64: v.string(), mimeType: v.string() });

type Media = { base64: string; mimeType: string };

export function isPdf(mimeType: string | null | undefined): boolean {
  return mimeType?.split(";")[0].trim().toLowerCase() === PDF_MIME_TYPE;
}

export function assertAudio(audio: Media) {
  if (!audio.mimeType.startsWith("audio/")) throw new ConvexError("Expected an audio recording");
  if (audio.base64.length > MAX_AUDIO_BASE64_LENGTH) throw new ConvexError("Recording too long");
}

export function assertImage(image: Media) {
  if (!image.mimeType.startsWith("image/")) throw new ConvexError("Expected an image");
  if (image.base64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new ConvexError("That image is too large. Try a closer, smaller photo.");
  }
}

/** A photo, or a PDF (a receipt or check that came by email), small enough to read */
export function assertImageOrPdf(media: Media) {
  if (!isPdf(media.mimeType)) {
    assertImage(media);
    return;
  }
  if (media.base64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new ConvexError("That PDF is too large to read. Try a photo of the page instead.");
  }
}
