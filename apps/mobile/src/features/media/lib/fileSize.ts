import { File } from "expo-file-system";

import { isPdf } from "@convex/lib/media";

import { MediaError } from "./errors";
import type { MediaFile } from "./types";

// The most a chosen file can be, in round megabytes as the Files app counts them (1 MB =
// 1,000,000 bytes), each just under what the server takes. Pictures are checked after they're
// downsized, so in practice only PDFs (and pictures that couldn't be downsized) hit these.
/** Receipts and checks, read straight by an action (MAX_IMAGE_BYTES, 3 MiB) */
export const MAX_SCAN_FILE_BYTES = 3_000_000;
/** Work orders, read from storage (MAX_DOCUMENT_BYTES, 15 MiB) */
export const MAX_WORK_ORDER_FILE_BYTES = 15_000_000;

/** "4.2 MB", the way the Files app shows sizes */
export function formatMegabytes(bytes: number): string {
  const megabytes = bytes / 1_000_000;
  return `${megabytes < 10 ? Number(megabytes.toFixed(1)) : Math.round(megabytes)} MB`;
}

/** The file's size in bytes, or undefined when it can't be read */
export function getFileSize(uri: string): number | undefined {
  try {
    return new File(uri).size ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Refuse a file over `maxBytes` with a plain message ("That PDF is too big to read (18 MB).
 * The most it can be is 15 MB."), adding `advice` when given.
 */
export function assertFileSize(file: MediaFile, maxBytes: number, advice?: string) {
  if (file.size === undefined || file.size <= maxBytes) return;
  const what = isPdf(file.mimeType) ? "That PDF" : "That picture";
  throw new MediaError(
    "tooBig",
    [
      `${what} is too big to read (${formatMegabytes(file.size)}).`,
      `The most it can be is ${formatMegabytes(maxBytes)}.`,
      advice,
    ]
      .filter(Boolean)
      .join(" "),
  );
}
