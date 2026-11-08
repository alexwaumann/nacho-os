import { File, UploadType } from "expo-file-system";

import type { Id } from "@convex/_generated/dataModel";

import type { MediaFile } from "./types";

export const UPLOAD_FAILED = "Couldn't send it. Check your internet and try again.";

/**
 * Upload a picture (or PDF) on the phone to Convex storage, straight from the file (no base64 in
 * JavaScript), and return its storage id. `uploadUrl` comes from `api.files.generateUploadUrl`;
 * `useUploadFile` gets one for you.
 */
export async function uploadFile(uploadUrl: string, file: MediaFile): Promise<Id<"_storage">> {
  let result;
  try {
    result = await new File(file.uri).upload(uploadUrl, {
      httpMethod: "POST",
      uploadType: UploadType.BINARY_CONTENT,
      headers: { "Content-Type": file.mimeType },
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
