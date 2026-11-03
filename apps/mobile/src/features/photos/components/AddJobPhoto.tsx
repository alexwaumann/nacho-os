import { useMutation } from "convex/react";
import { useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast, toastError } from "@/components/ui/toast";
import { choosePhotos, PickImagesError, takePhoto } from "@/features/add-job/lib/pickImages";
import type { PickedImage } from "@/features/add-job/lib/pickImages";
import { ActionButton } from "@/features/job-detail/components/SheetParts";
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

  const handlePick = async (pick: () => Promise<PickedImage[] | null>) => {
    setIsPicking(true);
    let images: PickedImage[] | null;
    try {
      images = await pick();
    } catch (error) {
      if (error instanceof PickImagesError && error.isSettingsError) {
        Alert.alert("Camera is off", error.message, [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]);
      } else {
        toastError("Couldn't get the photo", error);
      }
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
        onPress={() => void handlePick(takePhoto)}
      />
      <ActionButton
        title="Choose from library"
        icon="photo.on.rectangle"
        disabled={isBusy}
        onPress={() => void handlePick(choosePhotos)}
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
