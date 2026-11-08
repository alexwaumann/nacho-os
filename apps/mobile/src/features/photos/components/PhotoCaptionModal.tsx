import { Image } from "expo-image";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";

import { SheetBar } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

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
      <SheetBar
        title="Add a caption"
        cancelLabel="Skip"
        onCancel={onSkip}
        onSave={() => onSave(draft)}
        isSaveDisabled={isEmpty}
      />
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

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  body: { padding: space.lg, gap: space.lg },
  preview: { width: "100%", height: 220, borderRadius: radius.lg, borderWidth: 1 },
});
