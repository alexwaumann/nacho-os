import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast, toastError } from "@/components/ui/toast";
import type { PickedImage } from "@/features/add-job/lib/pickImages";
import { uploadImage } from "@/features/add-job/lib/uploadImage";

/**
 * Adds photos to a job, like the web's useAddJobPhoto: each is uploaded, then attached to the
 * job. Returns the ids of the photos that made it, in the order given.
 */
export function useAddJobPhoto(jobId: Id<"jobs">) {
  const [isUploading, setIsUploading] = useState(false);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createPhoto = useMutation(api.jobPhotos.create);

  const addPhotos = async (images: PickedImage[]): Promise<Id<"jobPhotos">[]> => {
    if (images.length === 0) return [];
    setIsUploading(true);
    const added: Id<"jobPhotos">[] = [];
    try {
      for (const image of images) {
        const imageId = await uploadImage(await generateUploadUrl(), image);
        added.push(await createPhoto({ jobId, imageId }));
      }
      toast.success(added.length === 1 ? "Photo added" : `${added.length} photos added`);
    } catch (error) {
      console.error("Failed to add photo:", error);
      toastError(added.length > 0 ? "Some photos didn't make it" : "Couldn't add the photo", error);
    } finally {
      setIsUploading(false);
    }
    return added;
  };

  return { addPhotos, isUploading };
}
