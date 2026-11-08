import { ActionSheetIOS, Alert, Linking } from "react-native";

import { toast } from "@/components/ui/toast";

import { MediaError } from "./errors";
import { assertFileSize, MAX_SCAN_FILE_BYTES } from "./fileSize";
import { chooseFiles, choosePhotos, scanDocument, takePhoto } from "./pickers";
import type { MediaFile } from "./types";

/** Where a receipt or check photo comes from ("file": a PDF or picture in the Files app) */
export type CaptureSource = "scanner" | "camera" | "library" | "file";

const SOURCE_LABELS: Record<CaptureSource, string> = {
  scanner: "Scan it",
  camera: "Take a photo",
  library: "Choose from Photos",
  file: "Choose a file",
};
const SOURCES: CaptureSource[] = ["scanner", "camera", "library", "file"];

// iOS ignores a new screen (scanner, camera, photo picker) presented while an action sheet or
// alert is still animating away, and the picker's promise then never settles. Wait it out.
// Toasts are cleared first too (see clearToastsBeforePresenting); they're gone after the wait.
const DISMISS_ANIMATION_MS = 450;
const waitForDismiss = () => new Promise((resolve) => setTimeout(resolve, DISMISS_ANIMATION_MS));

/** Ask where the photo comes from with the native action sheet. Null if he cancels. */
function chooseCaptureSource(title: string): Promise<CaptureSource | null> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...SOURCES.map((source) => SOURCE_LABELS[source]), "Cancel"],
        cancelButtonIndex: SOURCES.length,
      },
      (index) => resolve(SOURCES[index] ?? null),
    );
  });
}

/**
 * One receipt or check, downsized for reading: a scanned page (the first, if he scans several),
 * a photo, or a PDF or picture from Files small enough for the reading action (about 3 MB).
 */
async function captureImage(source: CaptureSource): Promise<MediaFile | null> {
  try {
    switch (source) {
      case "scanner":
        return (await scanDocument("receipt"))?.[0] ?? null;
      case "camera":
        return (await takePhoto("receipt"))?.[0] ?? null;
      case "library":
        return (await choosePhotos("receipt", { isMultiple: false }))?.[0] ?? null;
      case "file": {
        const file = (await chooseFiles("receipt"))?.[0];
        if (!file) return null;
        assertFileSize(file, MAX_SCAN_FILE_BYTES, "Try a photo of it instead.");
        return file;
      }
    }
  } catch (error) {
    if (error instanceof MediaError) throw error;
    console.log(`Capture from ${source} failed:`, error);
    throw new MediaError("cameraFailed");
  }
}

function askToChoosePhoto(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert("Can't use the camera", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Choose a photo", isPreferred: true, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Ask where a receipt or check photo comes from (scan it, take a photo, choose one or a file)
 * and get it, downsized for reading. Resolves to null when he backs out. Problems are explained
 * here: no camera offers the photo library instead, a blocked camera offers Settings, anything
 * else is a toast.
 */
export async function getImage(title: string): Promise<MediaFile | null> {
  toast.dismiss();
  let source: CaptureSource | null = await chooseCaptureSource(title);

  while (source) {
    await waitForDismiss();
    try {
      return await captureImage(source);
    } catch (error) {
      const mediaError = error instanceof MediaError ? error : new MediaError("cameraFailed");

      if (mediaError.isUnavailable) {
        source = (await askToChoosePhoto(mediaError.message)) ? "library" : null;
        continue;
      }
      if (mediaError.isSettingsError) {
        Alert.alert("Camera is off for Nacho OS", mediaError.message, [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", isPreferred: true, onPress: () => void Linking.openSettings() },
        ]);
        return null;
      }
      toast.error(source === "file" ? "Couldn't use that file" : "Couldn't get the photo", {
        description: mediaError.message,
      });
      return null;
    }
  }

  return null;
}
