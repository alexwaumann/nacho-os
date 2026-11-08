import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, space } from "@/lib/theme";

// The pieces sheets and modals share: header rows with Cancel / Done / Save, and a footer

interface HeaderButtonProps {
  label: string;
  onPress: () => void;
  /** Bold, for the button that finishes (Save, Done) */
  isBold?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A text button for a sheet's header, like Cancel, Done or Save; at least 56 pt */
export function HeaderButton({ label, onPress, isBold, disabled, style }: HeaderButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.headerButton,
        {
          opacity:
            disabled ? 0.4
            : pressed ? 0.6
            : 1,
        },
        style,
      ]}
    >
      <Text variant="label" tone="primary" style={isBold && styles.bold}>
        {label}
      </Text>
    </Pressable>
  );
}

interface SheetBarProps {
  title: string;
  /** Left button, e.g. "Cancel" or "Skip" */
  cancelLabel?: string;
  onCancel: () => void;
  /** Omit for sheets that save on tap */
  onSave?: () => void;
  isSaveDisabled?: boolean;
}

/**
 * The top bar of a page sheet: Cancel, a centered title and Save, like iOS. At the top, so the
 * keyboard never covers them.
 */
export function SheetBar({
  title,
  cancelLabel = "Cancel",
  onCancel,
  onSave,
  isSaveDisabled,
}: SheetBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { borderColor: colors.border }]}>
      <HeaderButton label={cancelLabel} onPress={onCancel} style={styles.barButton} />
      <Text variant="label" style={styles.barTitle} numberOfLines={2}>
        {title}
      </Text>
      {onSave ?
        <HeaderButton
          label="Save"
          onPress={onSave}
          isBold
          disabled={isSaveDisabled}
          style={styles.barButton}
        />
      : <View style={styles.barSpacer} />}
    </View>
  );
}

interface SheetTitleProps {
  title: string;
  /** Under the title, e.g. "3 picked"; the button then lines up with the title's top */
  subtitle?: ReactNode;
  /** The button at the right, e.g. "Done" or "Cancel" */
  actionLabel: string;
  onAction: () => void;
  isActionBold?: boolean;
}

/** A sheet's big title with a Done or Cancel button at its right */
export function SheetTitle({
  title,
  subtitle,
  actionLabel,
  onAction,
  isActionBold,
}: SheetTitleProps) {
  return (
    <View style={[styles.titleRow, subtitle ? styles.alignTop : styles.alignCenter]}>
      <View style={styles.titleText}>
        <Text variant="title">{title}</Text>
        {subtitle}
      </View>
      <HeaderButton label={actionLabel} onPress={onAction} isBold={isActionBold} />
    </View>
  );
}

/** Buttons pinned to the bottom of a sheet, above the home indicator */
export function SheetFooter({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.footer,
        {
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, space.lg),
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: minTapSize,
    minWidth: minTapSize,
    paddingHorizontal: space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  bold: { fontWeight: "800" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barTitle: { flex: 1, textAlign: "center" },
  barButton: { minWidth: 88, paddingHorizontal: space.md },
  barSpacer: { minWidth: 88 },
  titleRow: { flexDirection: "row", gap: space.md },
  alignTop: { alignItems: "flex-start" },
  alignCenter: { alignItems: "center" },
  titleText: { flex: 1, gap: space.xs },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
