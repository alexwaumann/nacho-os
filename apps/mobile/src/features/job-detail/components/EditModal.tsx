import type { ReactNode } from "react";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { Text } from "@/components/ui/text";
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
        <View style={[styles.bar, { borderColor: colors.border }]}>
          <BarButton label="Cancel" onPress={onCancel} />
          <Text variant="label" style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {onSave ?
            <BarButton label="Save" onPress={onSave} isBold disabled={isSaveDisabled} />
          : <View style={styles.barSpacer} />}
        </View>
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
  barSpacer: { minWidth: 88 },
  bold: { fontWeight: "800" },
  body: { padding: space.lg, gap: space.lg },
  input: {
    minHeight: minTapSize,
    fontSize: typography.body.fontSize,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  multiline: { minHeight: 200, textAlignVertical: "top", lineHeight: typography.body.lineHeight },
});
