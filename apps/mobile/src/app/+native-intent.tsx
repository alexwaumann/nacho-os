import { receiveOpenedFile } from "@/features/open-in/lib/openedFiles";

/**
 * Every URL the app is opened with passes through here before Expo Router sees it.
 *
 * "Open in Nacho OS" (a PDF shared from Mail or Files) opens the app with a file:// URL, which
 * isn't a route: keep the file for the Add Job sheet (see features/open-in) and stay where he
 * is, or start on Today when the app wasn't running. Other links (nachoos://job/<id>) pass
 * through unchanged.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    if (receiveOpenedFile(path)) return initial ? "/" : null;
  } catch (error) {
    console.error("[open-in] couldn't take the opened file:", error);
  }
  return path;
}
