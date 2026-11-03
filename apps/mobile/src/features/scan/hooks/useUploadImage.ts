import { useMutation } from "convex/react";
import { File } from "expo-file-system";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import type { CapturedImage } from "../lib/capture";

/**
 * Upload a captured photo to Convex storage and return its storage ID, like the web's
 * `useUploadImage` (an upload URL, then a POST of the raw file).
 */
export function useUploadImage() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  return async (image: CapturedImage): Promise<Id<"_storage">> => {
    const uploadUrl = await generateUploadUrl();
    const response = await new File(image.uri).upload(uploadUrl, {
      httpMethod: "POST",
      headers: { "Content-Type": image.mimeType },
      mimeType: image.mimeType,
      sessionType: "foreground",
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error("Couldn't upload the photo. Check the internet connection and try again.");
    }

    const { storageId } = JSON.parse(response.body) as { storageId: Id<"_storage"> };
    return storageId;
  };
}
