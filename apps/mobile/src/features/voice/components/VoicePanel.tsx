import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { FullWindowOverlay } from "react-native-screens";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

import { COUNTDOWN_MS } from "../hooks/useVoiceMic";
import type { VoiceMic } from "../hooks/useVoiceMic";

/**
 * Recording surfaces use one deep red in light and dark mode: the dark theme's destructive red
 * is too light to carry white text.
 */
export const RECORDING_RED = "#c8000a";

export function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface VoicePanelProps {
  mic: VoiceMic;
  /** Shown while the recording is sent and applied, e.g. "Updating the job…". */
  processingLabel: string;
  /** A question from the last reply, pinned until he answers it. */
  followUpQuestion?: string | null;
  /** Hide the pinned question (e.g. the global one while a job sheet covers the tabs). */
  isFollowUpHidden?: boolean;
  onDismissFollowUp?: () => void;
  /** Distance from the bottom of the screen, to sit above the tab bar or at the sheet's foot. */
  bottomOffset: number;
}

/**
 * The big card at the bottom of the screen while a mic is busy: Listening (clock, countdown,
 * Cancel and Send), Starting, Thinking, the too-short hint, or a question waiting for an answer.
 * Drawn above everything, sheets included, so a recording can always be finished.
 */
export function VoicePanel({
  mic,
  processingLabel,
  followUpQuestion,
  isFollowUpHidden = false,
  onDismissFollowUp,
  bottomOffset,
}: VoicePanelProps) {
  const isFollowUp =
    mic.isIdle &&
    !mic.isProcessing &&
    !mic.isHintVisible &&
    !!followUpQuestion &&
    !isFollowUpHidden;
  const isVisible = !mic.isIdle || mic.isProcessing || mic.isHintVisible || isFollowUp;

  if (!isVisible) return null;

  return (
    <FullWindowOverlay>
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
        <View pointerEvents="box-none" style={[styles.anchor, { bottom: bottomOffset }]}>
          {isFollowUp ?
            <FollowUpCard
              question={followUpQuestion}
              onAnswer={mic.handlePress}
              onDismiss={onDismissFollowUp}
            />
          : <PanelContent mic={mic} processingLabel={processingLabel} />}
        </View>
      </View>
    </FullWindowOverlay>
  );
}

function PanelContent({ mic, processingLabel }: Pick<VoicePanelProps, "mic" | "processingLabel">) {
  const { colors } = useTheme();

  if (mic.isRecording) {
    const isCountingDown = mic.remainingMs <= COUNTDOWN_MS;
    return (
      <Animated.View
        entering={FadeInDown}
        exiting={FadeOutDown}
        accessibilityRole="alert"
        style={[styles.card, { backgroundColor: RECORDING_RED }]}
      >
        <View style={styles.row}>
          <View style={styles.dot} />
          <View style={styles.flex}>
            <Text variant="heading" style={styles.onRed} maxFontSizeMultiplier={1.6}>
              Listening… {formatElapsed(mic.elapsedMs)}
            </Text>
            <Text style={styles.onRed} maxFontSizeMultiplier={1.6}>
              {isCountingDown ?
                `Sends by itself in ${Math.max(Math.ceil(mic.remainingMs / 1000), 0)}s`
              : "Talk, then tap Send"}
            </Text>
          </View>
        </View>
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
            onPress={() => mic.cancel()}
            style={({ pressed }) => [
              styles.button,
              styles.cancel,
              { borderColor: "#ffffff", opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <SymbolView name="xmark" size={22} tintColor="#ffffff" weight="bold" />
            <Text variant="label" style={styles.onRed} maxFontSizeMultiplier={1.5}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send recording"
            onPress={mic.send}
            style={({ pressed }) => [
              styles.button,
              styles.send,
              { backgroundColor: "#ffffff", opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <SymbolView name="paperplane.fill" size={24} tintColor={RECORDING_RED} />
            <Text variant="label" style={{ color: RECORDING_RED }} maxFontSizeMultiplier={1.5}>
              Send
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  const label =
    mic.isProcessing ? processingLabel
    : mic.isStarting ? "Starting the mic…"
    : "Too short. Tap the mic, talk, then tap Send.";

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      accessibilityRole="alert"
      style={[styles.card, styles.row, { backgroundColor: colors.foreground }]}
    >
      {mic.isProcessing || mic.isStarting ?
        <ActivityIndicator size="large" color={colors.background} />
      : <SymbolView name="mic.slash.fill" size={28} tintColor={colors.background} />}
      <Text
        variant="heading"
        style={[styles.flex, { color: colors.background }]}
        maxFontSizeMultiplier={1.6}
      >
        {label}
      </Text>
      {mic.isStarting ?
        <Pressable
          accessibilityRole="button"
          onPress={() => mic.cancel()}
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text variant="label" style={{ color: colors.background }} maxFontSizeMultiplier={1.5}>
            Cancel
          </Text>
        </Pressable>
      : null}
    </Animated.View>
  );
}

interface FollowUpCardProps {
  question: string | null | undefined;
  onAnswer: () => void;
  onDismiss?: () => void;
}

/** The last reply's question, pinned until he answers; tap it to start answering. */
function FollowUpCard({ question, onAnswer, onDismiss }: FollowUpCardProps) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      style={[
        styles.card,
        styles.followUp,
        { backgroundColor: colors.card, borderColor: colors.primary },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${question}. Tap to answer`}
        onPress={onAnswer}
        style={({ pressed }) => [styles.row, styles.flex, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.micCircle, { backgroundColor: colors.primary }]}>
          <SymbolView name="mic.fill" size={26} tintColor={colors.primaryForeground} />
        </View>
        <View style={styles.flex}>
          <Text variant="label" maxFontSizeMultiplier={1.6}>
            {question}
          </Text>
          <Text variant="caption" tone="primary" maxFontSizeMultiplier={1.6}>
            Tap here to answer
          </Text>
        </View>
      </Pressable>
      {onDismiss ?
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss the question"
          onPress={onDismiss}
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <SymbolView name="xmark" size={20} tintColor={colors.mutedForeground} weight="bold" />
        </Pressable>
      : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { justifyContent: "flex-end" },
  anchor: { position: "absolute", left: space.lg, right: space.lg },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  followUp: { flexDirection: "row", alignItems: "center", borderWidth: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  onRed: { color: "#ffffff" },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#ffffff" },
  buttons: { flexDirection: "row", gap: space.md },
  button: {
    flex: 1,
    minHeight: minTapSize + space.sm,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  cancel: { borderWidth: 2 },
  send: { flex: 1.4 },
  micCircle: {
    width: minTapSize,
    height: minTapSize,
    borderRadius: minTapSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    minWidth: minTapSize,
    minHeight: minTapSize,
    alignItems: "center",
    justifyContent: "center",
  },
});
