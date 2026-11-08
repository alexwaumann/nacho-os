import * as DocumentPicker from "expo-document-picker";
import { Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from "react-native-document-scanner-plugin";

import { isPdf, PDF_MIME_TYPE } from "@convex/lib/media";
import type { ImagePurpose } from "@shared/media/imageResize";
import { clearToastsBeforePresenting } from "@/components/ui/toast";

import { downsizeImages } from "./downsize";
import { MediaError } from "./errors";
import { getFileSize } from "./fileSize";
import type { ChosenFile, MediaFile } from "./types";

// The scanner's and picker's own JPEG quality. The picture is downsized and re-encoded right
// after (IMAGE_RESIZE), so these only matter when that fails and the picture goes up as taken.
// Library photos can still come back as HEIC (seen on iOS 27); downsizing turns them into JPEG.
const SCANNER_QUALITY = 70; // 0-100
const PICKER_QUALITY = 0.6; // 0-1

/** Most photos he can pick at once */
const MAX_PICKED_PHOTOS = 10;

/**
 * The Simulator has no camera, and expo-image-picker's camera throws a native exception (an app
 * crash) when there isn't one. Every iPhone has a camera, so only the Simulator needs catching:
 * its app containers live under CoreSimulator on the Mac.
 */
function isCameraMissing() {
  return Paths.document.uri.includes("/CoreSimulator/");
}

const toFileUri = (uri: string) => (uri.startsWith("file://") ? uri : `file://${uri}`);

const fromPicker = (assets: ImagePicker.ImagePickerAsset[]): MediaFile[] =>
  assets.map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize,
  }));

/**
 * Scan paper with the iPhone's document scanner (finds the page edges, flattens it, takes several
 * pages). Returns the pages in order, downsized for `purpose`, or null if he cancelled.
 */
export async function scanDocument(purpose: ImagePurpose): Promise<MediaFile[] | null> {
  if (isCameraMissing()) throw new MediaError("cameraMissing");
  await clearToastsBeforePresenting();

  let result;
  try {
    result = await DocumentScanner.scanDocument({
      croppedImageQuality: SCANNER_QUALITY,
      responseType: ResponseType.ImageFilePath,
    });
  } catch (error) {
    console.log("Document scanner failed:", error);
    const message = error instanceof Error ? error.message : "";
    if (/not supported/i.test(message)) throw new MediaError("scannerUnsupported");
    if (/permission|denied|authoriz/i.test(message)) throw new MediaError("scannerDenied");
    throw new MediaError("scannerFailed");
  }

  if (result.status === ScanDocumentResponseStatus.Cancel || !result.scannedImages?.length) {
    return null;
  }
  const pages = result.scannedImages.map((uri) => ({
    uri: toFileUri(uri),
    mimeType: "image/jpeg",
  }));
  return downsizeImages(pages, purpose);
}

/** Take one photo with the camera, downsized for `purpose`. Null if he cancelled. */
export async function takePhoto(purpose: ImagePurpose): Promise<MediaFile[] | null> {
  if (isCameraMissing()) throw new MediaError("cameraMissing");
  await clearToastsBeforePresenting();

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new MediaError("cameraDenied");

  let result;
  try {
    result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: PICKER_QUALITY,
    });
  } catch (error) {
    console.log("Camera failed:", error);
    throw new MediaError("cameraFailed");
  }
  return result.canceled ? null : downsizeImages(fromPicker(result.assets), purpose);
}

/**
 * Choose photos from the photo library (up to 10, in the order he taps them, or just one),
 * downsized for `purpose`. Null if he cancelled.
 */
export async function choosePhotos(
  purpose: ImagePurpose,
  { isMultiple = true }: { isMultiple?: boolean } = {},
): Promise<MediaFile[] | null> {
  await clearToastsBeforePresenting();

  let result;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: PICKER_QUALITY,
      allowsMultipleSelection: isMultiple,
      orderedSelection: isMultiple,
      selectionLimit: isMultiple ? MAX_PICKED_PHOTOS : 1,
    });
  } catch (error) {
    console.log("Photo library failed:", error);
    throw new MediaError("libraryFailed");
  }
  return result.canceled ? null : downsizeImages(fromPicker(result.assets), purpose);
}

const TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: PDF_MIME_TYPE,
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
};

function getMimeType(asset: DocumentPicker.DocumentPickerAsset): string | undefined {
  const type = asset.mimeType?.toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPES_BY_EXTENSION[extension];
}

/**
 * Choose PDFs or pictures in the Files app (iCloud Drive, Downloads, a saved email attachment).
 * Pictures come back downsized for `purpose` (as JPEG); PDFs come back unchanged. Resolves to
 * null if he cancels; throws a MediaError when a file isn't a PDF or picture. Check the sizes
 * with `assertFileSize`.
 */
export async function chooseFiles(
  purpose: ImagePurpose,
  { isMultiple = false } = {},
): Promise<ChosenFile[] | null> {
  await clearToastsBeforePresenting();

  let result;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: [PDF_MIME_TYPE, "image/*"],
      multiple: isMultiple,
      copyToCacheDirectory: true,
    });
  } catch (error) {
    console.log("Document picker failed:", error);
    throw new MediaError("filesFailed");
  }
  if (result.canceled || result.assets.length === 0) return null;

  const files = result.assets.map((asset): ChosenFile => {
    const mimeType = getMimeType(asset);
    if (!mimeType || !(isPdf(mimeType) || mimeType.startsWith("image/"))) {
      throw new MediaError(
        "notMedia",
        `"${asset.name}" isn't a PDF or a picture, so it can't be read.`,
      );
    }
    return {
      uri: asset.uri,
      mimeType,
      name: asset.name,
      size: asset.size ?? getFileSize(asset.uri),
    };
  });
  return downsizeImages(files, purpose);
}
