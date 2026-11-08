import { Directory, File, FileMode, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

import { PDF_MIME_TYPE } from "@convex/lib/media";
import {
  hasPdfHeader,
  isInboxFile,
  parseOpenedFileUrl,
  PDF_HEADER_BYTES,
} from "@shared/media/openedFile";
import { MediaError } from "@/features/media/lib/errors";
import { assertFileSize, MAX_WORK_ORDER_FILE_BYTES } from "@/features/media/lib/fileSize";
import type { ChosenFile, MediaFile } from "@/features/media/lib/types";

// "Open in Nacho OS": PDFs shared to the app from Mail or Files. iOS copies each one into the
// app's inbox folder (tmp/<bundle id>-Inbox) and opens the app with a file:// URL to it (see +native-intent.tsx).
// The URLs wait here, outside React, until he's signed in and the Add Job sheet takes them.

let pendingUrls: string[] = [];
const listeners = new Set<() => void>();
/** How many Add Job sheets are taking opened files (0 or 1) */
let receiverCount = 0;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Keep a file another app opened in this one, to be added as a job. Returns false for any other
 * URL (an ordinary nachoos:// link), which Expo Router should handle as usual.
 */
export function receiveOpenedFile(url: string): boolean {
  if (!parseOpenedFileUrl(url)) return false;
  // iOS can deliver the same URL twice at launch (initial URL and the "url" event)
  if (!pendingUrls.includes(url)) {
    pendingUrls = [...pendingUrls, url];
    emit();
  }
  return true;
}

/** The opened files waiting to be added; taking them empties the list */
export function takeOpenedFiles(): string[] {
  const urls = pendingUrls;
  if (urls.length === 0) return urls;
  pendingUrls = [];
  emit();
  return urls;
}

/** True while opened files are waiting for the Add Job sheet */
export function useHasOpenedFiles(): boolean {
  return useSyncExternalStore(subscribe, () => pendingUrls.length > 0);
}

/** Whether an Add Job sheet is open to take opened files */
export function isReceiverOpen() {
  return receiverCount > 0;
}

/** Called by the Add Job sheet while it is open (see useReceiveOpenedFiles) */
export function registerReceiver() {
  receiverCount++;
  return () => {
    receiverCount--;
  };
}

// This launch's copies of opened files, in the cache. Earlier launches' folders are deleted by
// cleanUpOpenedFiles: the list of work orders being sent doesn't outlive the app.
const OPENED_ROOT = "opened-files";
const sessionId = Date.now().toString(36);
let nextCopyId = 0;

function deleteQuietly(item: File | Directory) {
  try {
    if (item.exists) item.delete();
  } catch (error) {
    console.warn("[open-in] couldn't delete", item.uri, error);
  }
}

/**
 * Get an opened file ready to send as a work order: check it is a readable PDF under the size
 * limit and move it out of the Inbox into this launch's cache folder (so the Inbox never fills
 * up). Throws a MediaError with a plain message otherwise; the Inbox copy is deleted then too.
 */
export function readOpenedFile(url: string): ChosenFile {
  const opened = parseOpenedFileUrl(url);
  if (!opened)
    throw new MediaError("filesFailed", "Couldn't open that file. Please share it again.");
  const file = new File(opened.uri);
  const discardInboxCopy = () => {
    if (isInboxFile(file.uri)) deleteQuietly(file);
  };

  try {
    if (!file.exists) {
      throw new MediaError("filesFailed", `Couldn't open "${opened.name}". Please share it again.`);
    }
    if (!opened.isPdf || !readsAsPdf(file)) {
      throw new MediaError("notMedia", `"${opened.name}" isn't a PDF, so it can't be read.`);
    }
    const chosen: ChosenFile = {
      uri: file.uri,
      mimeType: PDF_MIME_TYPE,
      name: opened.name,
      size: file.size ?? undefined,
    };
    assertFileSize(chosen, MAX_WORK_ORDER_FILE_BYTES, "Try photos of the pages instead.");

    const folder = new Directory(Paths.cache, OPENED_ROOT, sessionId, String(nextCopyId++));
    folder.create({ intermediates: true, idempotent: true });
    file.moveSync(folder);
    return { ...chosen, uri: file.uri };
  } catch (error) {
    discardInboxCopy();
    if (error instanceof MediaError) throw error;
    console.error("[open-in] reading the opened file failed:", error);
    throw new MediaError("filesFailed", `Couldn't open "${opened.name}". Please share it again.`);
  }
}

function readsAsPdf(file: File): boolean {
  const handle = file.open(FileMode.ReadOnly);
  try {
    return hasPdfHeader(handle.readBytesSync(PDF_HEADER_BYTES));
  } finally {
    handle.close();
  }
}

/** Delete this app's copy of an opened file once it's off the list (other files are left) */
export function discardOpenedFile(file: MediaFile) {
  if (!file.uri.includes(`/${OPENED_ROOT}/${sessionId}/`)) return;
  deleteQuietly(new File(file.uri).parentDirectory);
}

/**
 * Delete opened files nothing will send any more: earlier launches' copies, and Inbox files
 * that aren't waiting to be added (left when the app was closed before it took them).
 */
export function cleanUpOpenedFiles() {
  try {
    const root = new Directory(Paths.cache, OPENED_ROOT);
    if (root.exists) {
      for (const item of root.list()) if (item.name !== sessionId) deleteQuietly(item);
    }
    const waitingNames = new Set(pendingUrls.map((url) => parseOpenedFileUrl(url)?.name));
    for (const inbox of getInboxes()) {
      for (const item of inbox.list()) {
        if (item instanceof File && !waitingNames.has(item.name)) deleteQuietly(item);
      }
    }
  } catch (error) {
    console.warn("[open-in] cleaning up opened files failed:", error);
  }
}

/** The folders iOS copies opened files into: tmp/<bundle id>-Inbox, or Documents/Inbox */
function getInboxes(): Directory[] {
  const tmp = new Directory(Paths.document.parentDirectory, "tmp");
  const inboxes =
    tmp.exists ?
      tmp
        .list()
        .filter(
          (item): item is Directory => item instanceof Directory && item.name.endsWith("-Inbox"),
        )
    : [];
  const legacyInbox = new Directory(Paths.document, "Inbox");
  return legacyInbox.exists ? [...inboxes, legacyInbox] : inboxes;
}
