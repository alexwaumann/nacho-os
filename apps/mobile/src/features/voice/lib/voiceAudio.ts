import { ConvexError } from "convex/values";
import { Directory, File, Paths } from "expo-file-system";

import { MAX_AUDIO_BASE64_LENGTH } from "@convex/lib/media";
import { audioMimeTypeFor } from "@shared/voice/voiceClient";

import type { DevClip } from "./devClip";

/** A recording as the voice actions take it: base64 plus the bare mime type. */
export interface VoiceAudio {
  base64: string;
  mimeType: string;
}

function checkSize(base64: string) {
  // The server refuses it too; failing here saves uploading it on a weak signal
  if (base64.length > MAX_AUDIO_BASE64_LENGTH) {
    throw new ConvexError("That recording is too long. Try a shorter one.");
  }
}

/** Reads a finished recording (an .m4a in the cache) and deletes the file. */
export async function readRecording(uri: string): Promise<VoiceAudio> {
  const file = new File(uri);
  try {
    const base64 = await file.base64();
    checkSize(base64);
    return { base64, mimeType: audioMimeTypeFor(uri) };
  } finally {
    deleteQuietly(file);
  }
}

/** Deletes a recording that won't be sent. */
export function discardRecording(uri: string | null) {
  if (uri) deleteQuietly(new File(uri));
}

function deleteQuietly(file: File) {
  try {
    if (file.exists) file.delete();
  } catch (error) {
    console.log("Deleting the recording failed:", error);
  }
}

/** DEV ONLY: downloads a test clip (see devClip.ts) and reads it like a recording. */
export async function readDevClip(clip: DevClip): Promise<VoiceAudio> {
  const folder = new Directory(Paths.cache, `voice-dev-${Date.now()}`);
  folder.create({ intermediates: true, idempotent: true });
  try {
    const file = new File(folder, clip.url.split(/[?#]/)[0].split("/").pop() || "clip.m4a");
    await File.downloadFileAsync(clip.url, file);
    const base64 = await file.base64();
    checkSize(base64);
    return { base64, mimeType: clip.mimeType ?? audioMimeTypeFor(clip.url) };
  } finally {
    try {
      folder.delete();
    } catch (error) {
      console.log("Deleting the dev clip failed:", error);
    }
  }
}
