import type { ReactNode } from "react";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { SheetBar } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space, typography } from "@/lib/theme";

interface ModalShellProps {
  visible: boolean;
  title: string;
  onCancel: () => void;
  /** Omit for pickers that save on tap */
  onSave?: () => void;
  isSaveDisabled?: boolean;
  children: ReactNode;
}

/**
 * A page sheet over the job sheet with Cancel and Save at the top, where the keyboard can't
 * cover them.
 */
export function ModalShell({
  visible,
  title,
  onCancel,
  onSave,
  isSaveDisabled,
  children,
}: ModalShellProps) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <SheetBar
          title={title}
          onCancel={onCancel}
          onSave={onSave}
          isSaveDisabled={isSaveDisabled}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.body}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface TextEditModalProps {
  visible: boolean;
  title: string;
  initialValue: string;
  placeholder: string;
  isMultiline?: boolean;
  /** Save even when the text is empty (to clear notes or a caption) */
  canSaveEmpty?: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/** Type one value (a note, an access code, a caption) in a big text box */
export function TextEditModal({ visible, ...props }: TextEditModalProps) {
  // Mounted fresh each time it opens, so the draft starts from the saved value
  return visible ? <TextEditModalBody {...props} /> : null;
}

function TextEditModalBody({
  title,
  initialValue,
  placeholder,
  isMultiline,
  canSaveEmpty,
  onSave,
  onCancel,
}: Omit<TextEditModalProps, "visible">) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(initialValue);
  const isEmpty = draft.trim() === "";

  return (
    <ModalShell
      visible
      title={title}
      onCancel={onCancel}
      onSave={() => onSave(draft)}
      isSaveDisabled={isEmpty && !canSaveEmpty}
    >
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel={title}
        autoFocus
        multiline={isMultiline}
        autoCapitalize="sentences"
        returnKeyType={isMultiline ? "default" : "done"}
        onSubmitEditing={
          isMultiline || (isEmpty && !canSaveEmpty) ? undefined : () => onSave(draft)
        }
        maxFontSizeMultiplier={typography.body.maxScale}
        style={[
          styles.input,
          isMultiline && styles.multiline,
          { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      />
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  body: { padding: space.lg, gap: space.lg },
  input: {
    minHeight: minTapSize,
    fontSize: typography.body.fontSize,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  multiline: { minHeight: 160, textAlignVertical: "top", lineHeight: typography.body.lineHeight },
});
