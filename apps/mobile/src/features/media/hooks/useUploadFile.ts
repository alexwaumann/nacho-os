import { useMutation } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { uploadFile } from "../lib/upload";
import type { MediaFile } from "../lib/types";

/**
 * Upload a picture or PDF from the pickers to Convex storage and return its storage id, like the
 * web's `useUploadImage`: a one-time upload URL, then a POST of the raw file. Pictures from the
 * pickers are already downsized.
 */
export function useUploadFile() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  return async (file: MediaFile): Promise<Id<"_storage">> =>
    uploadFile(await generateUploadUrl(), file);
}
