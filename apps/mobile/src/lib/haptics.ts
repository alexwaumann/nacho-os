import * as Haptics from "expo-haptics";

// Fire and forget: a haptic that can't play (Low Power Mode, the Simulator) isn't worth an error
function play(feedback: Promise<void>) {
  feedback.catch(() => {});
}

/**
 * Every haptic in the app, named for what happened, so the same moment always feels the same.
 * Use these instead of calling `expo-haptics` directly.
 */
export const haptics = {
  /** A choice changed: a segmented control, a switch */
  selection: () => play(Haptics.selectionAsync()),
  /** A swipe crossed the point where letting go runs its action (or opens it) */
  swipeThreshold: () => play(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A light tap: something unchecked, a small step back */
  light: () => play(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Picked something up to drag, started or stopped recording */
  medium: () => play(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => play(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** It worked: added to today, marked done, a task checked off, a code copied */
  success: () => play(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** The last of something is done (the last task): a heavy thump, then success */
  finished: () => {
    play(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setTimeout(
      () => play(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      150,
    );
  },
  warning: () => play(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => play(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
