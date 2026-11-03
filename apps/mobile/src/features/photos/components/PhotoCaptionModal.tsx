import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

interface PhotoCaptionModalProps {
  /** The photo just added; null hides the modal */
  imageUri: string | null;
  onSave: (caption: string) => void;
  onSkip: () => void;
}

/**
 * Right after he adds a photo: an optional caption, to tell Bathroom 1 from Bathroom 2 (like the
 * web's PhotoCaptionDialog). Skip and Save sit at the top, where the keyboard can't cover them.
 */
export function PhotoCaptionModal({ imageUri, onSave, onSkip }: PhotoCaptionModalProps) {
  return (
    <Modal
      visible={!!imageUri}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onSkip}
    >
      {/* Mounted fresh each time, so the draft starts empty */}
      {imageUri ?
        <CaptionForm imageUri={imageUri} onSave={onSave} onSkip={onSkip} />
      : null}
    </Modal>
  );
}

function CaptionForm({ imageUri, onSave, onSkip }: PhotoCaptionModalProps & { imageUri: string }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");
  const isEmpty = draft.trim() === "";

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <View style={[styles.bar, { borderColor: colors.border }]}>
        <BarButton label="Skip" onPress={onSkip} />
        <Text variant="label" style={styles.title} numberOfLines={2}>
          Add a caption
        </Text>
        <BarButton label="Save" onPress={() => onSave(draft)} isBold disabled={isEmpty} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.body}
      >
        <Image
          source={{ uri: imageUri }}
          style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.muted }]}
          contentFit="contain"
          accessibilityLabel="The photo you just added"
        />
        <TextField
          label="Caption (optional)"
          value={draft}
          onChangeText={setDraft}
          placeholder="Like Bathroom 2, before"
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          maxLength={200}
          onSubmitEditing={() => (isEmpty ? onSkip() : onSave(draft))}
        />
      </ScrollView>
    </View>
  );
}

function BarButton({
  label,
  onPress,
  isBold,
  disabled,
}: {
  label: string;
  onPress: () => void;
  isBold?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.barButton,
        {
          opacity:
            disabled ? 0.4
            : pressed ? 0.6
            : 1,
        },
      ]}
    >
      <Text variant="label" tone="primary" style={isBold && styles.bold}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: "center" },
  barButton: {
    minHeight: minTapSize,
    minWidth: 88,
    paddingHorizontal: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  bold: { fontWeight: "800" },
  body: { padding: space.lg, gap: space.lg },
  preview: { width: "100%", height: 220, borderRadius: radius.lg, borderWidth: 1 },
});
