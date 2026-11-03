import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Text } from "@/components/ui/text";
import { toast, toastError } from "@/components/ui/toast";
import { AddJobPhoto } from "@/features/photos/components/AddJobPhoto";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

import { openImageViewer } from "../lib/imageViewer";
import { TextEditModal } from "./EditModal";
import { EmptyNote } from "./SheetParts";

type JobPhotos = FunctionReturnType<typeof api.jobPhotos.listByJob>;
type JobPhoto = JobPhotos[number];

interface PhotosTabProps {
  jobId: Id<"jobs">;
  /** Oldest first, as the query returns them; undefined while loading */
  photos: JobPhotos | undefined;
}

/** The job's photos, newest first: add (camera or library), view big, caption, delete */
export function PhotosTab({ jobId, photos }: PhotosTabProps) {
  const { colors } = useTheme();
  const [editingId, setEditingId] = useState<Id<"jobPhotos"> | null>(null);
  const setCaption = useMutation(api.jobPhotos.setCaption).withOptimisticUpdate(
    (store, { photoId, caption }) => {
      for (const { args, value } of store.getAllQueries(api.jobPhotos.listByJob)) {
        if (!value?.some((photo) => photo._id === photoId)) continue;
        store.setQuery(
          api.jobPhotos.listByJob,
          args,
          value.map((photo) =>
            photo._id === photoId ? { ...photo, caption: caption.trim() || undefined } : photo,
          ),
        );
      }
    },
  );
  const removePhoto = useMutation(api.jobPhotos.remove);

  // Newest first: on a long job the photo he just took is the one he wants
  const newestFirst = [...(photos ?? [])].reverse();
  const viewable = newestFirst.filter((photo) => photo.imageUrl);
  const viewerImages = viewable.map((photo) => ({
    uri: photo.imageUrl!,
    caption: photo.caption,
  }));
  const editingPhoto = newestFirst.find((photo) => photo._id === editingId) ?? null;

  const handleSaveCaption = async (photo: JobPhoto, caption: string) => {
    setEditingId(null);
    if (caption.trim() === (photo.caption ?? "")) return;
    try {
      await setCaption({ photoId: photo._id, caption });
    } catch (error) {
      toastError("Couldn't save the caption", error);
    }
  };

  const handleDelete = (photo: JobPhoto) => {
    Alert.alert("Delete this photo?", "You can't undo this.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await removePhoto({ photoId: photo._id });
            toast.success("Photo deleted");
          } catch (error) {
            toastError("Couldn't delete the photo", error);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.tab}>
      <AddJobPhoto jobId={jobId} />

      {photos === undefined ?
        <ActivityIndicator />
      : photos.length === 0 ?
        <EmptyNote>No photos yet.</EmptyNote>
      : <View style={styles.grid}>
          {newestFirst.map((photo) => (
            <View key={photo._id} style={styles.cell}>
              <View
                style={[
                  styles.frame,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                {photo.imageUrl ?
                  <Pressable
                    accessibilityRole="imagebutton"
                    accessibilityLabel={
                      photo.caption ? `View photo: ${photo.caption}` : "View photo"
                    }
                    onPress={() =>
                      openImageViewer(
                        viewerImages,
                        viewable.findIndex((p) => p._id === photo._id),
                      )
                    }
                    style={({ pressed }) => [styles.fill, pressed && { opacity: 0.7 }]}
                  >
                    <Image
                      source={{ uri: photo.imageUrl }}
                      style={styles.fill}
                      contentFit="cover"
                      transition={150}
                    />
                  </Pressable>
                : <View style={[styles.fill, styles.center]}>
                    <ActivityIndicator />
                  </View>
                }
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    photo.caption ? `Delete photo: ${photo.caption}` : "Delete photo"
                  }
                  onPress={() => handleDelete(photo)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]}
                >
                  <SymbolView name="trash.fill" size={22} tintColor="#fff" />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  photo.caption ? `Edit caption: ${photo.caption}` : "Add caption"
                }
                onPress={() => setEditingId(photo._id)}
                style={({ pressed }) => [styles.caption, pressed && { opacity: 0.6 }]}
              >
                <Text
                  variant="caption"
                  tone={photo.caption ? "default" : "muted"}
                  style={styles.captionText}
                  numberOfLines={3}
                >
                  {photo.caption || "Add caption"}
                </Text>
                <SymbolView name="pencil" size={18} tintColor={colors.mutedForeground} />
              </Pressable>
            </View>
          ))}
        </View>
      }

      <TextEditModal
        visible={!!editingPhoto}
        title={editingPhoto?.caption ? "Edit caption" : "Add caption"}
        initialValue={editingPhoto?.caption ?? ""}
        placeholder="Like Bathroom 2, before"
        canSaveEmpty
        onSave={(caption) => editingPhoto && void handleSaveCaption(editingPhoto, caption)}
        onCancel={() => setEditingId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: space.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  cell: { width: "47%", gap: space.xs },
  frame: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  delete: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    minHeight: minTapSize,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  captionText: { flex: 1, fontWeight: "600" },
});
