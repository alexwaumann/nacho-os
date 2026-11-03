import { StyleSheet, TextInput, View } from "react-native";
import type { ComponentRef, Ref } from "react";
import type { TextInputProps } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space, typography } from "@/lib/theme";

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** A labelled text input in the body text size, with an optional error under it. */
export function TextField({ label, error, style, ...props }: TextFieldProps) {
  const { colors } = useTheme();
  const { fontSize, maxScale } = typography.body;

  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        maxFontSizeMultiplier={maxScale}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          // No lineHeight: it pushes single-line input text off-center on iOS
          { fontSize },
          {
            color: colors.foreground,
            backgroundColor: colors.muted,
            borderColor: error ? colors.destructive : colors.border,
          },
          style,
        ]}
        {...props}
      />
      {error ?
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  input: {
    minHeight: minTapSize,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
