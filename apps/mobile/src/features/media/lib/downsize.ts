import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import {
  chooseUploadVersion,
  formatBytes,
  IMAGE_RESIZE,
  isDownsizable,
  JPEG_MIME_TYPE,
} from "@shared/media/imageResize";
import type { ImagePurpose } from "@shared/media/imageResize";

import { getFileSize } from "./fileSize";
import type { MediaFile } from "./types";

/**
 * Shrink a picture to the size its `purpose` needs and save it as a JPEG (HEIC and PNG
 * included), like the web app does before uploading. PDFs come back unchanged. If it can't be
 * downsized, the original comes back (and the failure is logged), so the upload still happens.
 */
export async function downsizeImage<T extends MediaFile>(
  file: T,
  purpose: ImagePurpose,
): Promise<T> {
  if (!isDownsizable(file.mimeType)) return file;
  const { maxSide, quality } = IMAGE_RESIZE[purpose];
  const originalBytes = file.size ?? getFileSize(file.uri);

  try {
    // Decoded straight at the smaller size (the full-size photo never fills memory), with the
    // EXIF rotation applied, so the longest side ends up at most `maxSide`
    const context = ImageManipulator.manipulate(file.uri, {
      maxWidth: maxSide,
      maxHeight: maxSide,
    });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    image.release();
    context.release();

    const resizedBytes = getFileSize(result.uri);
    const version = chooseUploadVersion({
      originalMimeType: file.mimeType,
      originalBytes,
      resizedBytes,
    });
    if (__DEV__) {
      const before = `${file.mimeType} ${originalBytes === undefined ? "?" : formatBytes(originalBytes)}`;
      const after = `${result.width}×${result.height} JPEG ${resizedBytes === undefined ? "?" : formatBytes(resizedBytes)}`;
      console.log(`[media] ${purpose}: ${before} -> ${after} (sending the ${version})`);
    }
    if (version === "original") return { ...file, size: originalBytes };
    return { ...file, uri: result.uri, mimeType: JPEG_MIME_TYPE, size: resizedBytes };
  } catch (error) {
    console.warn(`[media] Couldn't downsize a ${purpose} picture; sending the original:`, error);
    return { ...file, size: originalBytes };
  }
}

/** Downsize several pictures, one at a time to keep memory low; the order is kept */
export async function downsizeImages<T extends MediaFile>(
  files: T[],
  purpose: ImagePurpose,
): Promise<T[]> {
  const downsized: T[] = [];
  for (const file of files) downsized.push(await downsizeImage(file, purpose));
  return downsized;
}
