import { Alert, Linking } from "react-native";

import { toast } from "@/components/ui/toast";

import { captureImage, CaptureError, chooseCaptureSource } from "./capture";
import type { CaptureSource, CapturedImage } from "./capture";

// iOS ignores a new screen (scanner, camera, photo picker) presented while an action sheet or
// alert is still animating away, and the picker's promise then never settles. Wait it out.
// The same happens while a toast is up: its overlay window becomes the key window, which the
// pickers present from. So toasts are cleared first, and are gone after the wait.
const DISMISS_ANIMATION_MS = 450;
const waitForDismiss = () => new Promise((resolve) => setTimeout(resolve, DISMISS_ANIMATION_MS));

function askToChoosePhoto(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert("Can't use the camera", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Choose a photo", isPreferred: true, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Ask where the photo comes from (scan it, take a photo, or choose one) and get it. Resolves to
 * null when he backs out. Problems are explained here: no camera offers the photo library
 * instead, a blocked camera offers Settings, anything else is a toast.
 */
export async function getImage(title: string): Promise<CapturedImage | null> {
  toast.dismiss();
  let source: CaptureSource | null = await chooseCaptureSource(title);

  while (source) {
    await waitForDismiss();
    try {
      return await captureImage(source);
    } catch (error) {
      const captureError =
        error instanceof CaptureError ? error : (
          new CaptureError("Couldn't get the photo. Please try again.")
        );

      if (captureError.isUnavailable) {
        source = (await askToChoosePhoto(captureError.message)) ? "library" : null;
        continue;
      }
      if (captureError.isSettingsError) {
        Alert.alert("Camera is off for Nacho OS", captureError.message, [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", isPreferred: true, onPress: () => void Linking.openSettings() },
        ]);
        return null;
      }
      toast.error("Couldn't get the photo", { description: captureError.message });
      return null;
    }
  }

  return null;
}
