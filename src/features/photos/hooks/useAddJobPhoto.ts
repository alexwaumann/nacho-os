import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

import { useUploadImage } from "@/hooks/useUploadImage";
import { processJobPhoto } from "@/lib/pdf";

/**
 * Adds photos to a job: each is downsized on the phone, uploaded, then attached to the job.
 * Returns the ids of the photos that made it, in the order given.
 */
export function useAddJobPhoto(jobId: Id<"jobs"> | null) {
  const [isUploading, setIsUploading] = useState(false);
  const uploadImage = useUploadImage();
  const createPhoto = useMutation(api.jobPhotos.create);

  const addPhotos = async (files: Array<File>): Promise<Array<Id<"jobPhotos">>> => {
    if (!jobId || files.length === 0) return [];
    setIsUploading(true);
    const added: Array<Id<"jobPhotos">> = [];
    try {
      for (const file of files) {
        const image = await processJobPhoto(file);
        const imageId = await uploadImage(image);
        added.push(await createPhoto({ jobId, imageId }));
      }
      toast.success(added.length === 1 ? "Photo added" : `${added.length} photos added`);
    } catch (error) {
      console.error("Failed to add photo:", error);
      toast.error(added.length > 0 ? "Some photos didn't make it" : "Couldn't add the photo", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUploading(false);
    }
    return added;
  };

  return { addPhotos, isUploading };
}
