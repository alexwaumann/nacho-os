import { useSegments } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { space, typography } from "@/lib/theme";

import { useGlobalVoiceCommand } from "../hooks/useGlobalVoiceCommand";
import { useVoiceMic } from "../hooks/useVoiceMic";
import { listenForDevClipLinks } from "../lib/devClip";
import { formatElapsed, RECORDING_RED, VoicePanel } from "./VoicePanel";

// The floating tab bar plus the accessory above it, measured on an iPhone 15 Pro Max (iOS 26)
const TAB_BAR_AND_ACCESSORY = 132;

/**
 * The global mic's state. Lives in the tabs layout, not in the accessory: iOS draws the
 * accessory twice (full and inline, when the tab bar shrinks), so neither copy may own state.
 */
export function useGlobalVoice() {
  const command = useGlobalVoiceCommand();
  const mic = useVoiceMic({
    isProcessing: command.isProcessing,
    onRecorded: (audio) => void command.handleRecorded(audio),
  });
  // A job sheet or another screen over the tabs hides the accessory, so the question goes too
  const segments = useSegments();
  const isOverTabs = segments[0] !== "(tabs)";

  // DEV ONLY: nachoos://?voiceClip=<url> feeds a clip to the next recording (see devClip.ts)
  useEffect(() => listenForDevClipLinks(), []);

  return { mic, command, isOverTabs };
}

type GlobalVoice = ReturnType<typeof useGlobalVoice>;

/** The mic bar above the tab bar, on every tab: tap, say anything, tap again to send. */
export function GlobalVoiceAccessory({ voice }: { voice: GlobalVoice }) {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const { colors } = useTheme();
  const { mic, command } = voice;
  const isInline = placement === "inline";
  const question = command.followUpQuestion;

  const label =
    mic.isRecording ?
      isInline ? formatElapsed(mic.elapsedMs)
      : `Listening ${formatElapsed(mic.elapsedMs)} · tap to send`
    : mic.isProcessing ? "Thinking…"
    : mic.isStarting ? "Starting…"
    : question && !isInline ? "Tap to answer"
    : isInline ? "Talk"
    : "Talk to Nacho";

  const tint = mic.isRecording ? "#ffffff" : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        mic.isRecording ? "Stop and send"
        : mic.isProcessing ?
          "Working on it"
        : question ?
          `${question}. Tap to answer`
        : "Talk to Nacho"
      }
      accessibilityState={{ busy: mic.isProcessing, selected: mic.isRecording }}
      disabled={mic.isProcessing}
      onPress={mic.handlePress}
      style={({ pressed }) => [
        styles.accessory,
        mic.isRecording && { backgroundColor: RECORDING_RED },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {mic.isProcessing || mic.isStarting ?
        <ActivityIndicator color={colors.primary} />
      : <SymbolView
          name={mic.isRecording ? "stop.fill" : "mic.fill"}
          size={isInline ? 17 : 20}
          tintColor={tint}
        />
      }
      <View style={styles.flex}>
        <Text
          variant="label"
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          style={[isInline && styles.inlineText, mic.isRecording && styles.onRed]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** The global mic's Listening / Thinking card and pinned question, above the tab bar. */
export function GlobalVoicePanel({ voice }: { voice: GlobalVoice }) {
  const insets = useSafeAreaInsets();
  const { mic, command, isOverTabs } = voice;

  return (
    <VoicePanel
      mic={mic}
      processingLabel="Thinking…"
      followUpQuestion={command.followUpQuestion}
      isFollowUpHidden={isOverTabs}
      onDismissFollowUp={command.dismissFollowUp}
      // Over a sheet there is no tab bar to clear
      bottomOffset={insets.bottom + (isOverTabs ? space.lg : TAB_BAR_AND_ACCESSORY)}
    />
  );
}

const styles = StyleSheet.create({
  accessory: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 999,
  },
  flex: { flex: 1 },
  inlineText: { fontSize: typography.caption.fontSize },
  onRed: { color: "#ffffff" },
});
