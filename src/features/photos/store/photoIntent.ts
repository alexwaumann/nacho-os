import { create } from "zustand";

import type { Id } from "../../../../convex/_generated/dataModel";

interface PhotoIntentState {
  /** The job he asked (by voice) to add a photo to; its sheet shows the camera button ready. */
  jobId: Id<"jobs"> | null;
  request: (jobId: Id<"jobs">) => void;
  clear: () => void;
}

/**
 * A browser only opens the camera from a tap, not from a voice reply that arrives later. So
 * "add a photo to Oak Street" opens the job's Photos tab and highlights Take photo instead;
 * this store carries that request from the voice agent to the job sheet.
 */
export const usePhotoIntent = create<PhotoIntentState>((set) => ({
  jobId: null,
  request: (jobId) => set({ jobId }),
  clear: () => set({ jobId: null }),
}));

export const requestPhoto = (jobId: Id<"jobs">) => usePhotoIntent.getState().request(jobId);

export const clearPhotoIntent = () => usePhotoIntent.getState().clear();
