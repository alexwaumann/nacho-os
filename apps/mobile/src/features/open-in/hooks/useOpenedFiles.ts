import { useRootNavigationState, useSegments } from "expo-router";
import { useEffect, useEffectEvent } from "react";

import { openAddJob } from "@/features/add-job/openAddJob";

import {
  cleanUpOpenedFiles,
  isReceiverOpen,
  registerReceiver,
  takeOpenedFiles,
  useHasOpenedFiles,
} from "../lib/openedFiles";

/**
 * For the root layout: when a PDF was opened in the app ("Open in Nacho OS"), show the Add Job
 * sheet once he's signed in (it takes the file from there). Over whatever is open, a job sheet
 * included; if Add Job is already up, it takes the file itself.
 */
export function useOpenAddJobForOpenedFiles(isSignedIn: boolean) {
  const hasOpenedFiles = useHasOpenedFiles();
  const isNavigationReady = !!useRootNavigationState()?.key;
  // Right after sign-in the guard is still swapping the sign-in screen for the tabs, and a push
  // then is dropped; wait until the sign-in screen is gone
  const isOnSignIn = useSegments()[0] === "sign-in";

  // Once per launch: files left over from before (see cleanUpOpenedFiles)
  useEffect(() => {
    cleanUpOpenedFiles();
  }, []);

  useEffect(() => {
    if (!hasOpenedFiles || !isSignedIn || !isNavigationReady || isOnSignIn) return;
    if (isReceiverOpen()) return;
    openAddJob();
  }, [hasOpenedFiles, isSignedIn, isNavigationReady, isOnSignIn]);
}

/**
 * For the Add Job sheet: hands it the opened files (file:// URLs) as they arrive, once `isReady`
 * (Convex has the sign-in, so they can be sent).
 */
export function useReceiveOpenedFiles(isReady: boolean, onFiles: (urls: string[]) => void) {
  const hasOpenedFiles = useHasOpenedFiles();
  const handleFiles = useEffectEvent(onFiles);

  useEffect(() => registerReceiver(), []);

  useEffect(() => {
    if (!isReady || !hasOpenedFiles) return;
    const urls = takeOpenedFiles();
    if (urls.length > 0) handleFiles(urls);
  }, [isReady, hasOpenedFiles]);
}
