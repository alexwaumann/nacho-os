import { Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS } from "react-native";
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from "react-native-document-scanner-plugin";

/** Where a receipt or check photo comes from */
export type CaptureSource = "scanner" | "camera" | "library";

/** A photo on the phone, ready to read and upload */
export interface CapturedImage {
  /** file:// URI in the app's cache */
  uri: string;
  mimeType: string;
}

/** Why a capture failed, with a plain message to show him */
export class CaptureError extends Error {
  /** The camera is blocked in Settings, so offer to open them */
  isSettingsError: boolean;
  /** The scanner or camera can't run on this phone; the photo library still works */
  isUnavailable: boolean;

  constructor(message: string, { isSettingsError = false, isUnavailable = false } = {}) {
    super(message);
    this.name = "CaptureError";
    this.isSettingsError = isSettingsError;
    this.isUnavailable = isUnavailable;
  }
}

// JPEG quality: keeps a full-page photo around 0.5–1.5 MB, well under the ~4 MB the reading
// action takes (base64), while the text stays sharp enough for Gemini
const SCANNER_QUALITY = 65; // 0–100
const PICKER_QUALITY = 0.6; // 0–1

const SOURCE_LABELS: Record<CaptureSource, string> = {
  scanner: "Scan it",
  camera: "Take a photo",
  library: "Choose from Photos",
};
const SOURCES: CaptureSource[] = ["scanner", "camera", "library"];

/**
 * Ask where the photo comes from with the native action sheet. Resolves to null if he cancels.
 */
export function chooseCaptureSource(title: string): Promise<CaptureSource | null> {
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
 * The Simulator has no camera, and expo-image-picker's camera throws a native exception (an app
 * crash) when there isn't one. Every iPhone has a camera, so only the Simulator needs catching:
 * its app containers live under CoreSimulator on the Mac.
 */
function isCameraMissing() {
  return Paths.document.uri.includes("/CoreSimulator/");
}

const CAMERA_UNAVAILABLE = "The camera isn't available here. Choose a photo instead.";

async function scanDocument(): Promise<CapturedImage | null> {
  if (isCameraMissing()) throw new CaptureError(CAMERA_UNAVAILABLE, { isUnavailable: true });

  let result;
  try {
    result = await DocumentScanner.scanDocument({
      croppedImageQuality: SCANNER_QUALITY,
      responseType: ResponseType.ImageFilePath,
    });
  } catch (error) {
    console.log("Document scanner failed:", error);
    const message = error instanceof Error ? error.message : "";
    if (/not supported/i.test(message)) {
      throw new CaptureError("The scanner doesn't work on this phone. Take a photo instead.", {
        isUnavailable: true,
      });
    }
    if (/permission|denied|authoriz/i.test(message)) {
      throw new CaptureError("Allow the camera in Settings > Nacho OS > Camera, then try again.", {
        isSettingsError: true,
      });
    }
    throw new CaptureError("The scanner stopped. Please try again.");
  }

  if (result.status === ScanDocumentResponseStatus.Cancel) return null;
  // He may scan several pages; a receipt or check is one, so keep the first
  const uri = result.scannedImages?.[0];
  if (!uri) return null;
  return { uri, mimeType: "image/jpeg" };
}

async function takePhoto(): Promise<CapturedImage | null> {
  if (isCameraMissing()) throw new CaptureError(CAMERA_UNAVAILABLE, { isUnavailable: true });

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new CaptureError("Allow the camera in Settings > Nacho OS > Camera, then try again.", {
      isSettingsError: true,
    });
  }

  return toCapturedImage(
    await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: PICKER_QUALITY }),
  );
}

async function choosePhoto(): Promise<CapturedImage | null> {
  return toCapturedImage(
    await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: PICKER_QUALITY }),
  );
}

function toCapturedImage(result: ImagePicker.ImagePickerResult): CapturedImage | null {
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  // With a quality below 1 the picker re-encodes the photo as JPEG
  return { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
}

/**
 * Get one photo from the document scanner, the camera or the photo library. Resolves to null if
 * he backs out, and throws a CaptureError with a plain message when it can't.
 */
export async function captureImage(source: CaptureSource): Promise<CapturedImage | null> {
  try {
    switch (source) {
      case "scanner":
        return await scanDocument();
      case "camera":
        return await takePhoto();
      case "library":
        return await choosePhoto();
    }
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    console.log(`Capture from ${source} failed:`, error);
    throw new CaptureError("Couldn't get the photo. Please try again.");
  }
}
