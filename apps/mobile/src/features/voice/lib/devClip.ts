import * as Linking from "expo-linking";

import { toast } from "@/components/ui/toast";

/**
 * DEV ONLY: feed a prepared audio clip to the next recording instead of the microphone, so the
 * whole voice pipeline can be tested in the Simulator (whose mic hears nothing useful).
 *
 *   nachoos://?voiceClip=http://localhost:8765/clip.m4a
 *   nachoos://?voiceClip=http://localhost:8765/clip.m4a&voiceMime=text/plain   (server rejects it)
 *
 * The link opens Today (it's an ordinary app link) and arms the clip. The next recording, from
 * either mic, is simulated (same Listening / Send flow, but the microphone isn't touched) and
 * sends the clip instead. Starting that recording uses the clip up, even if it's then cancelled. Every call
 * site checks `__DEV__`, so release builds drop this code and ignore the link.
 */
export interface DevClip {
  url: string;
  /** Overrides the mime type sent to the server, to test its error handling */
  mimeType?: string;
}

let armedClip: DevClip | null = null;

/** The armed clip, if any; using it disarms it. */
export function takeDevClip(): DevClip | null {
  if (!__DEV__) return null;
  const clip = armedClip;
  armedClip = null;
  return clip;
}

function handleUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const clipUrl = queryParams?.voiceClip;
  if (typeof clipUrl !== "string" || !clipUrl) return;
  const mimeType = queryParams?.voiceMime;
  armedClip = { url: clipUrl, mimeType: typeof mimeType === "string" ? mimeType : undefined };
  console.log(`[voice] dev clip armed: ${clipUrl}${armedClip.mimeType ? ` as ${mimeType}` : ""}`);
  toast.info("Dev: next recording uses a clip", {
    description: clipUrl.split("/").pop(),
    id: "voice-dev-clip",
  });
}

/** Starts listening for dev clip links; returns the unsubscribe. A no-op in release builds. */
export function listenForDevClipLinks() {
  if (!__DEV__) return () => {};
  const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
  return () => subscription.remove();
}
