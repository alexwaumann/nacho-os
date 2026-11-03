import { File, UploadType } from "expo-file-system";

import type { Id } from "@convex/_generated/dataModel";

import type { PickedImage } from "./pickImages";

const UPLOAD_FAILED = "Couldn't send it. Check your internet and try again.";

/**
 * Upload a picture (or PDF) on the phone to Convex storage, straight from the file (no base64 in
 * JavaScript), and return its storage id. `uploadUrl` comes from `api.files.generateUploadUrl`.
 */
export async function uploadImage(uploadUrl: string, image: PickedImage): Promise<Id<"_storage">> {
  let result;
  try {
    result = await new File(image.uri).upload(uploadUrl, {
      httpMethod: "POST",
      uploadType: UploadType.BINARY_CONTENT,
      headers: { "Content-Type": image.mimeType },
    });
  } catch (error) {
    console.error("Upload failed:", error);
    throw new Error(UPLOAD_FAILED);
  }
  if (result.status < 200 || result.status >= 300) {
    console.error("Upload failed:", result.status, result.body);
    throw new Error(UPLOAD_FAILED);
  }
  const { storageId } = JSON.parse(result.body) as { storageId: Id<"_storage"> };
  return storageId;
}
