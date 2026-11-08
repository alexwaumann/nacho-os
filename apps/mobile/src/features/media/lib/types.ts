/**
 * A picture (or a PDF from Files) on the phone, ready to read or upload. Pictures from the
 * pickers in this folder are already downsized (see `downsizeImage`).
 */
export interface MediaFile {
  /** file:// URI in the app's cache */
  uri: string;
  mimeType: string;
  /** The file's name, for one chosen in Files (e.g. "Work order 5521.pdf") */
  name?: string;
  /** Bytes, when known */
  size?: number;
}

/** A PDF or picture chosen in the Files app; it always has a name */
export type ChosenFile = MediaFile & { name: string };
