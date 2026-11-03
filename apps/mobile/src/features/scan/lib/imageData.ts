import { File } from "expo-file-system";

import { MAX_IMAGE_BASE64_LENGTH } from "@convex/lib/media";

import type { CapturedImage } from "./capture";

/** An image as the reading actions take it (`api.ai.analyzeReceipt` / `analyzeCheck`) */
export interface ImageData {
  base64: string;
  mimeType: string;
}

export const IMAGE_TOO_LARGE =
  "That photo is too big to read. Try a closer photo of just the paper.";

/** Read a captured photo as base64, refusing ones too big for the reading action */
export async function readImageData(image: CapturedImage): Promise<ImageData> {
  const base64 = await new File(image.uri).base64();
  if (base64.length > MAX_IMAGE_BASE64_LENGTH) throw new Error(IMAGE_TOO_LARGE);
  return { base64, mimeType: image.mimeType };
}
