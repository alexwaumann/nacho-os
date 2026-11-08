import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast, toastError } from "@/components/ui/toast";
import { useUploadFile } from "@/features/media/hooks/useUploadFile";
import { getImage } from "@/features/media/lib/getImage";

/**
 * Add a receipt to a job he already has open, like the web's `useAddReceipt`: get the photo,
 * upload it, and queue it. Convex reads it in the background, and the job's Money tab shows
 * "Reading a receipt…" until the receipt appears.
 */
export function useAddReceipt(jobId: Id<"jobs">) {
  const enqueueReceipt = useMutation(api.receipts.enqueueReceipt);
  const uploadFile = useUploadFile();
  const [isAdding, setIsAdding] = useState(false);

  const addReceipt = async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const image = await getImage("Add a receipt");
      if (!image) return;
      const imageStorageId = await uploadFile(image);
      await enqueueReceipt({ jobId, imageStorageId });
      toast.success("Receipt added", { description: "Reading it now. It shows up here soon." });
    } catch (error) {
      toastError("Couldn't add the receipt", error);
    } finally {
      setIsAdding(false);
    }
  };

  return { addReceipt, isAdding };
}
