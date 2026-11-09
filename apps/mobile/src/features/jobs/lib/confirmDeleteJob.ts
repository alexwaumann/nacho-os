import { Alert } from "react-native";

/**
 * Asks before deleting a job (the native destructive alert), since it can't be undone. Used by
 * the job sheet and the Jobs list's long-press menu, so both ask the same way.
 */
export function confirmDeleteJob(onDelete: () => void) {
  Alert.alert(
    "Delete this job?",
    "Its tasks, receipts, check and photos are deleted too. You can't undo this.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete job", style: "destructive", onPress: onDelete },
    ],
  );
}
