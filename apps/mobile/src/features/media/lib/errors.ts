/** What went wrong getting a picture or file */
export type MediaErrorKind =
  /** The camera is turned off for the app in Settings */
  | "cameraDenied"
  /** No camera here (the Simulator) */
  | "cameraMissing"
  | "cameraFailed"
  /** The document scanner was refused the camera */
  | "scannerDenied"
  /** The document scanner can't run on this phone */
  | "scannerUnsupported"
  | "scannerFailed"
  | "libraryFailed"
  | "filesFailed"
  /** A file from Files that isn't a PDF or a picture */
  | "notMedia"
  /** A file from Files over the size limit */
  | "tooBig";

const GENERIC = "Couldn't get the photo. Please try again.";
const ALLOW_CAMERA = "Allow the camera in Settings > Nacho OS > Camera, then try again.";

// The wording for a receipt or check; the photo pickers for jobs reword some (see pickPhotos)
const MESSAGES: Record<Exclude<MediaErrorKind, "notMedia" | "tooBig">, string> = {
  cameraDenied: ALLOW_CAMERA,
  cameraMissing: "The camera isn't available here. Choose a photo instead.",
  cameraFailed: GENERIC,
  scannerDenied: ALLOW_CAMERA,
  scannerUnsupported: "The scanner doesn't work on this phone. Take a photo instead.",
  scannerFailed: "The scanner stopped. Please try again.",
  libraryFailed: GENERIC,
  filesFailed: "Files didn't open. Please try again.",
};

/** Why a picture or file couldn't be had, with a plain message to show him */
export class MediaError extends Error {
  readonly kind: MediaErrorKind;

  constructor(kind: MediaErrorKind, message?: string) {
    super(message ?? (kind in MESSAGES ? MESSAGES[kind as keyof typeof MESSAGES] : GENERIC));
    this.name = "MediaError";
    this.kind = kind;
  }

  /** The camera is blocked in Settings, so offer to open them */
  get isSettingsError() {
    return this.kind === "cameraDenied" || this.kind === "scannerDenied";
  }

  /** The scanner or camera can't run here; the photo library still works */
  get isUnavailable() {
    return this.kind === "cameraMissing" || this.kind === "scannerUnsupported";
  }
}
