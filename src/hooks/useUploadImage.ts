import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

import type { ImageData } from "@/lib/pdf";

function base64ToBlob(image: ImageData): Blob {
  const binaryStr = atob(image.base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: image.mimeType });
}

/**
 * Upload a base64 image (from processReceiptFile) to Convex storage and return its storage ID.
 */
export function useUploadImage() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  return async (image: ImageData): Promise<Id<"_storage">> => {
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": image.mimeType },
      body: base64ToBlob(image),
    });

    if (!response.ok) {
      throw new Error("Failed to upload the photo");
    }

    const { storageId } = await response.json();
    return storageId as Id<"_storage">;
  };
}
