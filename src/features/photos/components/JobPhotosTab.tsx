import { useMutation } from "convex/react";
import { Camera, Images, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { useAddJobPhoto } from "../hooks/useAddJobPhoto";
import { clearPhotoIntent, usePhotoIntent } from "../store/photoIntent";
import { PhotoCaptionDialog } from "./PhotoCaptionDialog";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

import { ImageViewer } from "@/components/ImageViewer";
import { Button } from "@/components/ui/button";
import { useImageViewer } from "@/hooks/useImageViewer";
import { cn } from "@/lib/utils";

export type JobPhoto = Doc<"jobPhotos"> & { imageUrl: string | null };

interface JobPhotosTabProps {
  jobId: Id<"jobs">;
  /** The job's photos, oldest first (as the query returns them); undefined while loading */
  photos: Array<JobPhoto> | undefined;
}

/**
 * The Photos tab of the job sheet: take or pick photos, which are downsized before upload,
 * caption them if he wants to (to tell Bathroom 1 from Bathroom 2), view them big, delete them.
 */
export function JobPhotosTab({ jobId, photos }: JobPhotosTabProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  // The photo whose caption is being typed; a freshly taken photo offers its caption right away
  const [editingId, setEditingId] = useState<Id<"jobPhotos"> | null>(null);

  const { addPhotos, isUploading } = useAddJobPhoto(jobId);
  const setCaption = useMutation(api.jobPhotos.setCaption);
  const removePhoto = useMutation(api.jobPhotos.remove);
  const { openViewer, viewerProps } = useImageViewer();
  // Asked by voice to add a photo here: the camera button pulses until he taps it
  const isCameraRequested = usePhotoIntent((state) => state.jobId) === jobId;

  // Newest first: on a long job the photo he just took is the one he wants
  const newestFirst = [...(photos ?? [])].reverse();
  const viewable = newestFirst.filter((photo) => photo.imageUrl);
  const viewerImages = viewable.map((photo) => ({
    src: photo.imageUrl!,
    caption: photo.caption,
  }));
  const editingPhoto = newestFirst.find((photo) => photo._id === editingId) ?? null;

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // Reset input so the same file can be picked again
    clearPhotoIntent();
    const added = await addPhotos(files);
    // One new photo: offer its caption right away; a batch from the library is left as is
    if (added.length === 1) setEditingId(added[0]);
  };

  const handleSaveCaption = async (photo: JobPhoto, caption: string) => {
    setEditingId(null);
    if (caption.trim() === (photo.caption ?? "")) return;
    try {
      await setCaption({ photoId: photo._id, caption });
    } catch (error) {
      console.error("Failed to save caption:", error);
      toast.error("Couldn't save the caption", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleDelete = async (photo: JobPhoto) => {
    if (!confirm("Delete this photo?")) return;
    try {
      await removePhoto({ photoId: photo._id });
      toast("Photo deleted");
    } catch (error) {
      console.error("Failed to delete photo:", error);
      toast.error("Couldn't delete the photo", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          className={cn(
            "w-full h-16 text-xl font-black rounded-2xl",
            isCameraRequested && "ring-4 ring-primary/40 animate-pulse",
          )}
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ?
            <Loader2 className="size-6 animate-spin" />
          : <Camera className="size-6" />}
          {isUploading ? "Adding photo…" : "Take photo"}
        </Button>
        <Button
          variant="outline"
          className="w-full h-14 text-lg font-bold rounded-2xl"
          onClick={() => libraryInputRef.current?.click()}
          disabled={isUploading}
        >
          <Images className="size-5" />
          Choose from library
        </Button>
        {isCameraRequested && (
          <p className="text-center text-base font-semibold text-primary">
            Tap Take photo when you're ready.
          </p>
        )}
        {/* The camera input opens the camera straight away on a phone; the library one lets
            him pick several at once */}
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFilesChange}
          className="hidden"
        />
        <input
          type="file"
          ref={libraryInputRef}
          accept="image/*"
          multiple
          onChange={handleFilesChange}
          className="hidden"
        />
      </div>

      {photos && photos.length === 0 && (
        <p className="text-base text-muted-foreground text-center py-6 px-4 bg-muted/10 rounded-[1.5rem] border border-dashed border-border/50">
          No photos yet. Take one before you start and one when you're done.
        </p>
      )}

      {newestFirst.length > 0 && (
        <ul className="grid grid-cols-2 gap-4" aria-label="Job photos">
          {newestFirst.map((photo) => (
            <li key={photo._id} className="space-y-2">
              <div className="relative aspect-square rounded-[1.5rem] bg-muted overflow-hidden border border-border">
                {photo.imageUrl ?
                  <button
                    type="button"
                    aria-label={photo.caption ? `View photo: ${photo.caption}` : "View photo"}
                    onClick={() =>
                      openViewer(
                        viewerImages,
                        viewable.findIndex((p) => p._id === photo._id),
                      )
                    }
                    className="block w-full h-full"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption ?? "Job photo"}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                : <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                }
                <button
                  type="button"
                  aria-label="Delete photo"
                  onClick={() => void handleDelete(photo)}
                  className="absolute top-2 right-2 flex items-center justify-center h-11 w-11 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-destructive active:bg-destructive transition-colors"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(photo._id)}
                aria-label={photo.caption ? `Edit caption: ${photo.caption}` : "Add caption"}
                className="w-full min-h-11 flex items-center gap-2 px-1 text-left"
              >
                {photo.caption ?
                  <span className="text-base font-bold leading-snug line-clamp-2 flex-1 min-w-0">
                    {photo.caption}
                  </span>
                : <span className="text-base font-semibold text-muted-foreground flex-1">
                    Add caption
                  </span>
                }
                <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ImageViewer {...viewerProps} />
      <PhotoCaptionDialog
        open={!!editingPhoto}
        imageUrl={editingPhoto?.imageUrl ?? null}
        caption={editingPhoto?.caption ?? ""}
        onSave={(caption) => editingPhoto && void handleSaveCaption(editingPhoto, caption)}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}
