import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

// Small building blocks the job sheet's tabs share

interface SectionProps {
  title: string;
  /** Shown at the right of the heading, e.g. "3 of 5 done" */
  aside?: ReactNode;
  children: ReactNode;
}

/** A titled block of the sheet */
export function Section({ title, aside, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text variant="caption" tone="muted" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </Text>
        {aside}
      </View>
      {children}
    </View>
  );
}

/** A dashed box with a short message, for "nothing here yet" */
export function EmptyNote({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <Text tone="muted" style={styles.center}>
        {children}
      </Text>
    </View>
  );
}

type PillTone = "neutral" | "primary" | "success" | "warning" | "destructive";

/** A small colored label, e.g. the status or "Overdue" */
export function Pill({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: PillTone;
  icon?: SFSymbol;
}) {
  const { colors } = useTheme();
  const color = {
    neutral: colors.mutedForeground,
    primary: colors.primary,
    success: colors.success,
    warning: WARNING,
    destructive: colors.destructive,
  }[tone];
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: `${color}1A` }]}>
      {icon ?
        <SymbolView name={icon} size={18} tintColor={color} />
      : null}
      <Text variant="caption" style={{ color, fontWeight: "700" }} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </View>
  );
}

/** Orange for "not paid yet" and due dates, like the web app */
export const WARNING = "#ea580c";

type ActionVariant = "primary" | "secondary" | "destructive" | "outline" | "destructiveOutline";

interface ActionButtonProps extends Omit<PressableProps, "children" | "style"> {
  title: string;
  icon?: SFSymbol;
  variant?: ActionVariant;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A 56 pt button with an SF Symbol in front of its title */
export function ActionButton({
  title,
  icon,
  variant = "secondary",
  isLoading,
  disabled,
  style,
  ...props
}: ActionButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || isLoading;
  const background = {
    primary: colors.primary,
    secondary: colors.muted,
    destructive: colors.destructive,
    outline: "transparent",
    destructiveOutline: "transparent",
  }[variant];
  const foreground = {
    primary: colors.primaryForeground,
    secondary: colors.foreground,
    destructive: colors.destructiveForeground,
    outline: colors.primary,
    destructiveOutline: colors.destructive,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: background,
          borderColor:
            variant === "outline" || variant === "destructiveOutline" ? colors.border : background,
          opacity:
            isDisabled ? 0.5
            : pressed ? 0.7
            : 1,
        },
        style,
      ]}
      {...props}
    >
      {isLoading ?
        <ActivityIndicator color={foreground} />
      : <>
          {icon ?
            <SymbolView name={icon} size={22} tintColor={foreground} />
          : null}
          <Text variant="label" style={{ color: foreground, flexShrink: 1 }} numberOfLines={2}>
            {title}
          </Text>
        </>
      }
    </Pressable>
  );
}

interface IconButtonProps extends Omit<PressableProps, "children" | "style"> {
  icon: SFSymbol;
  accessibilityLabel: string;
  tint?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
}

/** A round 56 pt button with just an SF Symbol */
export function IconButton({ icon, tint, background, style, ...props }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: background ?? colors.muted, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
      {...props}
    >
      <SymbolView name={icon} size={26} tintColor={tint ?? colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    flexWrap: "wrap",
  },
  sectionTitle: { fontWeight: "800", letterSpacing: 1.2 },
  empty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: space.xl,
  },
  center: { textAlign: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  action: {
    minHeight: minTapSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderCurve: "continuous",
  },
  iconButton: {
    width: minTapSize,
    height: minTapSize,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
