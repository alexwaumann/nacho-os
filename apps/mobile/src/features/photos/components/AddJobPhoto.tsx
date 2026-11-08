import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast, toastError } from "@/components/ui/toast";
import { ActionButton } from "@/features/job-detail/components/SheetParts";
import { pickPhotos, showPickPhotosError } from "@/features/media/lib/pickPhotos";
import type { PhotoSource } from "@/features/media/lib/pickPhotos";
import type { MediaFile } from "@/features/media/lib/types";
import { space } from "@/lib/theme";

import { useAddJobPhoto } from "../hooks/useAddJobPhoto";
import { PhotoCaptionModal } from "./PhotoCaptionModal";

interface AddJobPhotoProps {
  jobId: Id<"jobs">;
}

/**
 * "Take photo" and "Choose from library" for the job sheet's Photos tab. One new photo offers a
 * caption right away; a batch from the library is left as is (captions can be added later).
 */
export function AddJobPhoto({ jobId }: AddJobPhotoProps) {
  const { addPhotos, isUploading } = useAddJobPhoto(jobId);
  const setCaption = useMutation(api.jobPhotos.setCaption);
  const [isPicking, setIsPicking] = useState(false);
  const [captioning, setCaptioning] = useState<{ id: Id<"jobPhotos">; uri: string } | null>(null);

  const handlePick = async (source: PhotoSource) => {
    setIsPicking(true);
    let images: MediaFile[] | null;
    try {
      images = await pickPhotos(source, "jobPhoto");
    } catch (error) {
      showPickPhotosError(error, "Couldn't get the photo");
      return;
    } finally {
      setIsPicking(false);
    }
    if (!images?.length) return;
    const added = await addPhotos(images);
    if (added.length === 1 && images.length === 1) {
      setCaptioning({ id: added[0], uri: images[0].uri });
    }
  };

  const handleSaveCaption = async (caption: string) => {
    const photo = captioning;
    setCaptioning(null);
    if (!photo || !caption.trim()) return;
    try {
      await setCaption({ photoId: photo.id, caption });
      toast.success("Caption saved");
    } catch (error) {
      toastError("Couldn't save the caption", error);
    }
  };

  const isBusy = isPicking || isUploading;

  return (
    <View style={styles.buttons}>
      <ActionButton
        title={isUploading ? "Adding photo…" : "Take photo"}
        icon="camera.fill"
        variant="primary"
        isLoading={isUploading}
        disabled={isBusy}
        onPress={() => void handlePick("camera")}
      />
      <ActionButton
        title="Choose from library"
        icon="photo.on.rectangle"
        disabled={isBusy}
        onPress={() => void handlePick("library")}
      />
      <PhotoCaptionModal
        imageUri={captioning?.uri ?? null}
        onSave={(caption) => void handleSaveCaption(caption)}
        onSkip={() => setCaptioning(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: space.md },
});
