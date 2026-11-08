// Files other apps hand to the iOS app ("Open in Nacho OS" from the share sheet in Mail or
// Files). iOS opens the app with a file:// URL to a copy of the file in the app's inbox folder:
// tmp/<bundle id>-Inbox on current iOS, Documents/Inbox on older versions.

/** A file another app opened in this one */
export interface OpenedFile {
  /** The file:// URL as iOS gave it */
  uri: string;
  /** The file's name, decoded, e.g. "Work order 5521.pdf" */
  name: string;
  /** Named like a PDF (".pdf"); check the contents with `hasPdfHeader` */
  isPdf: boolean;
}

/**
 * The file in a URL the app was opened with, or null when it isn't a file:// URL (an ordinary
 * nachoos:// link, which Expo Router handles as usual).
 */
export function parseOpenedFileUrl(url: string): OpenedFile | null {
  const match = /^file:\/\/([^?#]*)/i.exec(url.trim());
  if (!match) return null;
  const segments = match[1].split("/").filter(Boolean);
  const lastSegment = segments.at(-1);
  if (!lastSegment) return null;
  const name = safeDecode(lastSegment);
  return { uri: url.trim(), name, isPdf: /\.pdf$/i.test(name) };
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Whether a file is in the inbox where iOS puts files opened in the app (tmp/<bundle id>-Inbox,
 * or Documents/Inbox on older iOS)
 */
export function isInboxFile(url: string): boolean {
  return /\/(Documents\/Inbox|tmp\/[^/]+-Inbox)\/[^/]+$/.test(url.split(/[?#]/)[0]);
}

const PDF_MARKER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
/** How far into the file the PDF marker may start (the PDF spec allows junk before it) */
export const PDF_HEADER_BYTES = 1024;

/** Whether the first bytes of a file are a PDF's ("%PDF-" within the first 1024 bytes) */
export function hasPdfHeader(bytes: ArrayLike<number>): boolean {
  const end = Math.min(bytes.length, PDF_HEADER_BYTES) - PDF_MARKER.length;
  for (let start = 0; start <= end; start++) {
    if (PDF_MARKER.every((byte, offset) => bytes[start + offset] === byte)) return true;
  }
  return false;
}
