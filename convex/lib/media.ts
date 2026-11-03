import { ConvexError, v } from "convex/values";

// Base64 media sent straight to an action. Node actions take at most 5 MiB of arguments, so
// these leave room for the rest of the request.

/** ~60s of AAC is well under this */
export const MAX_AUDIO_BASE64_LENGTH = 4 * 1024 * 1024;
/** A compressed receipt photo or PDF page is usually well under 1 MB */
export const MAX_IMAGE_BASE64_LENGTH = 4 * 1024 * 1024;

export const mediaValidator = v.object({ base64: v.string(), mimeType: v.string() });

type Media = { base64: string; mimeType: string };

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
