import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import { processReceiptFile } from "@/lib/pdf";

export function useAddReceipt(jobId: Id<"jobs"> | null) {
  const [isUploading, setIsUploading] = useState(false);

  const enqueueReceipt = useMutation(api.receipts.enqueueReceipt);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const handleAddReceipt = async (file: File) => {
    if (!jobId) return;

    setIsUploading(true);
    try {
      // 1. Process file to single image (PDF first page or compressed image)
      const image = await processReceiptFile(file);

      // 2. Upload to Convex storage
      const uploadUrl = await generateUploadUrl();

      // Convert base64 to blob
      const binaryStr = atob(image.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: image.mimeType });

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": image.mimeType },
        body: blob,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = await response.json();

      // 3. Enqueue for background processing
      await enqueueReceipt({ jobId, imageStorageId: storageId });

      toast.success("Receipt queued for processing");
    } catch (error) {
      console.error("Failed to add receipt:", error);
      toast.error("Failed to add receipt", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return { handleAddReceipt, isUploading };
}
