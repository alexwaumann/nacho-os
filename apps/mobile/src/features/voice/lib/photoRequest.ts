import { toast } from "@/components/ui/toast";

/**
 * "Add a photo to Oak Street": the web app opens the job's Photos tab with Take photo
 * highlighted (`requestPhoto` in src/features/photos/store/photoIntent.ts).
 *
 * TODO(photos): the native photos feature (src/features/photos/, a parallel PR) should take this
 * over: open the camera, or highlight Take photo on the job's Photos tab. Until then he gets a
 * pointer to the tab. Called after the job sheet is opened on its Photos tab (global mic) or
 * from the job's own mic.
 */
export function showAddPhotoHint() {
  toast.info("Add the photo from the job's Photos tab", {
    description: "Tap Photos in the job, then take the picture.",
    duration: 8000,
    id: "voice-add-photo",
  });
}
