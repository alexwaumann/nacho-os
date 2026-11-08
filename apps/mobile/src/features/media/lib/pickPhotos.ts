import { Alert, Linking } from "react-native";

import type { ImagePurpose } from "@shared/media/imageResize";
import { toast } from "@/components/ui/toast";

import { MediaError } from "./errors";
import { choosePhotos, scanDocument, takePhoto } from "./pickers";
import type { MediaFile } from "./types";

/** Where photos for a job come from: a scan of the paperwork, the camera, or the library */
export type PhotoSource = "scanner" | "camera" | "library";

/**
 * The photo pickers for jobs (Add Job, a job's Photos tab), worded for picking several photos.
 * Returns the photos downsized for `purpose`, or null if he cancelled; throws a MediaError.
 */
export async function pickPhotos(
  source: PhotoSource,
  purpose: ImagePurpose,
  { isMultiple = true }: { isMultiple?: boolean } = {},
): Promise<MediaFile[] | null> {
  try {
    switch (source) {
      case "scanner":
        return await scanDocument(purpose);
      case "camera":
        return await takePhoto(purpose);
      case "library":
        return await choosePhotos(purpose, { isMultiple });
    }
  } catch (error) {
    throw toPhotosError(source, error);
  }
}

function toPhotosError(source: PhotoSource, error: unknown): MediaError {
  if (source === "scanner") {
    console.warn("Document scan failed:", error);
    return new MediaError(
      "scannerFailed",
      "The scanner didn't open. Take a photo or choose photos instead.",
    );
  }
  if (source === "camera") {
    if (error instanceof MediaError && error.kind === "cameraDenied") {
      return new MediaError(
        "cameraDenied",
        "Nacho OS isn't allowed to use the camera. You can turn it on in Settings.",
      );
    }
    console.warn("Camera failed:", error);
    return new MediaError("cameraFailed", "The camera didn't open. Choose photos instead.");
  }
  console.warn("Photo library failed:", error);
  return new MediaError("libraryFailed", "Your photos didn't open. Please try again.");
}

/**
 * Explain a pickPhotos error: a blocked camera offers Settings, anything else is a toast titled
 * `title`.
 */
export function showPickPhotosError(error: unknown, title: string) {
  if (error instanceof MediaError && error.isSettingsError) {
    Alert.alert("Camera is off", error.message, [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => void Linking.openSettings() },
    ]);
    return;
  }
  const message =
    error instanceof MediaError ? error.message : "That didn't work. Please try again.";
  toast.error(title, { description: message });
}
