import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import { isPdf, PDF_MIME_TYPE } from "@convex/lib/media";
import { clearToastsBeforePresenting } from "@/components/ui/toast";

/** A PDF or picture chosen in the Files app (iCloud Drive, Downloads, a saved email attachment) */
export interface ChosenFile {
  /** file:// URI of a copy in the app's cache */
  uri: string;
  mimeType: string;
  /** The file's name, e.g. "Work order 5521.pdf" */
  name: string;
  /** Bytes, when known */
  size?: number;
}

/** Why a chosen file can't be used, in plain words */
export class ChooseFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChooseFileError";
  }
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

// The most a chosen file can be, in round megabytes as the Files app counts them (1 MB =
// 1,000,000 bytes), each just under what the server takes
/** Receipts and checks, read straight by an action (MAX_IMAGE_BYTES, 3 MiB) */
export const MAX_SCAN_FILE_BYTES = 3_000_000;
/** Work orders, read from storage (MAX_DOCUMENT_BYTES, 15 MiB) */
export const MAX_WORK_ORDER_FILE_BYTES = 15_000_000;

/** "4.2 MB", the way the Files app shows sizes */
export function formatMegabytes(bytes: number): string {
  const megabytes = bytes / 1_000_000;
  return `${megabytes < 10 ? Number(megabytes.toFixed(1)) : Math.round(megabytes)} MB`;
}

/**
 * Refuse a file over `maxBytes` with a plain message ("That PDF is too big to read (18 MB).
 * The most it can be is 15 MB."), adding `advice` when given.
 */
export function assertFileSize(file: ChosenFile, maxBytes: number, advice?: string) {
  if (file.size === undefined || file.size <= maxBytes) return;
  const what = isPdf(file.mimeType) ? "That PDF" : "That picture";
  throw new ChooseFileError(
    [
      `${what} is too big to read (${formatMegabytes(file.size)}).`,
      `The most it can be is ${formatMegabytes(maxBytes)}.`,
      advice,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getFileSize(uri: string): number | undefined {
  try {
    return new File(uri).size ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Choose PDFs or pictures in the Files app. Resolves to null if he cancels; throws a
 * ChooseFileError when a file isn't a PDF or picture.
 */
export async function chooseFiles({ isMultiple = false } = {}): Promise<ChosenFile[] | null> {
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
    throw new ChooseFileError("Files didn't open. Please try again.");
  }
  if (result.canceled || result.assets.length === 0) return null;

  return result.assets.map((asset) => {
    const mimeType = getMimeType(asset);
    if (!mimeType || !(isPdf(mimeType) || mimeType.startsWith("image/"))) {
      throw new ChooseFileError(`"${asset.name}" isn't a PDF or a picture, so it can't be read.`);
    }
    return {
      uri: asset.uri,
      mimeType,
      name: asset.name,
      size: asset.size ?? getFileSize(asset.uri),
    };
  });
}
