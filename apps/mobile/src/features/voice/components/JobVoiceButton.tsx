import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Doc } from "@convex/_generated/dataModel";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, space } from "@/lib/theme";

import { useVoiceCommand } from "../hooks/useVoiceCommand";
import { useVoiceMic } from "../hooks/useVoiceMic";
import { RECORDING_RED, VoicePanel } from "./VoicePanel";

interface JobVoiceButtonProps {
  job: Doc<"jobs">;
}

/**
 * The job sheet's mic, next to More: tap, say what changed on this job, tap Send. Closing the
 * sheet mid-recording discards the recording (the recorder goes with the sheet).
 */
export function JobVoiceButton({ job }: JobVoiceButtonProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const command = useVoiceCommand(job);
  const mic = useVoiceMic({
    isProcessing: command.isProcessing,
    onRecorded: (audio) => void command.handleRecorded(audio),
    closedMessage: "The job was closed, so nothing was sent.",
  });

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mic.isRecording ? "Stop and send" : "Talk about this job"}
        accessibilityState={{ busy: mic.isProcessing, selected: mic.isRecording }}
        disabled={mic.isProcessing}
        hitSlop={4}
        onPress={mic.handlePress}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: mic.isRecording ? RECORDING_RED : colors.primary },
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {mic.isProcessing || mic.isStarting ?
          <ActivityIndicator color={colors.primaryForeground} />
        : <SymbolView
            name={mic.isRecording ? "stop.fill" : "mic.fill"}
            size={20}
            tintColor={mic.isRecording ? "#ffffff" : colors.primaryForeground}
          />
        }
      </Pressable>
      <VoicePanel
        mic={mic}
        processingLabel="Updating the job…"
        followUpQuestion={command.followUpQuestion}
        onDismissFollowUp={command.dismissFollowUp}
        bottomOffset={insets.bottom + space.lg}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: minTapSize,
    height: minTapSize,
    borderRadius: minTapSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
