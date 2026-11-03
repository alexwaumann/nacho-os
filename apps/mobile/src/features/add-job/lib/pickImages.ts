import * as ImagePicker from "expo-image-picker";
import DocumentScanner, { ResponseType } from "react-native-document-scanner-plugin";

import { clearToastsBeforePresenting } from "@/components/ui/toast";

/** A picture on the phone, ready to upload */
export interface PickedImage {
  uri: string;
  mimeType: string;
}

/**
 * Why taking or picking pictures didn't work, in plain words. `isSettingsError` means he turned
 * the permission off, so offer to open Settings.
 */
export class PickImagesError extends Error {
  isSettingsError: boolean;

  constructor(message: string, isSettingsError = false) {
    super(message);
    this.name = "PickImagesError";
    this.isSettingsError = isSettingsError;
  }
}

// JPEG quality: work orders stay readable and uploads stay around 1-2 MB. Pictures aren't
// resized (that needs expo-image-manipulator, a native module this build doesn't have yet).
const SCAN_QUALITY = 70; // 0-100
const PHOTO_QUALITY = 0.6;

const toPicked = (assets: ImagePicker.ImagePickerAsset[]): PickedImage[] =>
  assets.map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" }));

/**
 * Scan paperwork with the iPhone's document scanner (finds the page edges, flattens it, takes
 * several pages). Returns the pages in order, or null if he cancelled.
 */
export async function scanPaperwork(): Promise<PickedImage[] | null> {
  await clearToastsBeforePresenting();
  let result;
  try {
    result = await DocumentScanner.scanDocument({
      croppedImageQuality: SCAN_QUALITY,
      responseType: ResponseType.ImageFilePath,
    });
  } catch (error) {
    console.warn("Document scan failed:", error);
    throw new PickImagesError("The scanner didn't open. Take a photo or choose photos instead.");
  }
  if (result.status === "cancel" || !result.scannedImages?.length) return null;
  return result.scannedImages.map((uri) => ({
    uri: uri.startsWith("file://") ? uri : `file://${uri}`,
    mimeType: "image/jpeg",
  }));
}

/** Take one photo with the camera. Returns null if he cancelled. */
export async function takePhoto(): Promise<PickedImage[] | null> {
  await clearToastsBeforePresenting();
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new PickImagesError(
      "Nacho OS isn't allowed to use the camera. You can turn it on in Settings.",
      true,
    );
  }
  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: PHOTO_QUALITY,
    });
    return result.canceled ? null : toPicked(result.assets);
  } catch (error) {
    console.warn("Camera failed:", error);
    throw new PickImagesError("The camera didn't open. Choose photos instead.");
  }
}

/** Choose photos from the photo library, in the order he taps them. Null if he cancelled. */
export async function choosePhotos({ isMultiple = true }: { isMultiple?: boolean } = {}): Promise<
  PickedImage[] | null
> {
  await clearToastsBeforePresenting();
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: PHOTO_QUALITY,
      allowsMultipleSelection: isMultiple,
      orderedSelection: isMultiple,
      selectionLimit: isMultiple ? 10 : 1,
    });
    return result.canceled ? null : toPicked(result.assets);
  } catch (error) {
    console.warn("Photo library failed:", error);
    throw new PickImagesError("Your photos didn't open. Please try again.");
  }
}
