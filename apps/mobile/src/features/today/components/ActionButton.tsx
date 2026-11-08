import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";

import { Text } from "@/components/ui/text";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { buttonHeight, radius, space } from "@/lib/theme";

import type { SFSymbol } from "../lib/symbols";

type ActionButtonVariant = "primary" | "outline" | "destructive";

interface ActionButtonProps extends Omit<PressableProps, "children" | "style"> {
  title: string;
  icon?: SFSymbol;
  variant?: ActionButtonVariant;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A button with an SF Symbol before its label, 50 pt tall at the default text size. The `Button` primitive has no
 * icon yet; a later polish PR can fold this into it.
 */
export function ActionButton({
  title,
  icon,
  variant = "outline",
  isLoading = false,
  disabled,
  style,
  ...props
}: ActionButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || isLoading;
  const iconSize = useScaledSize(20);

  const look = {
    primary: { background: colors.primary, border: colors.primary, text: colors.primaryForeground },
    outline: { background: colors.card, border: colors.border, text: colors.foreground },
    destructive: { background: colors.card, border: colors.destructive, text: colors.destructive },
  }[variant];
  const iconColor = variant === "outline" ? colors.primary : look.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: look.background,
          borderColor: look.border,
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
        <ActivityIndicator color={iconColor} />
      : icon ?
        <SymbolView name={icon} size={iconSize} tintColor={iconColor} weight="semibold" />
      : null}
      <Text variant="label" style={[styles.label, { color: look.text }]} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: buttonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  label: { flexShrink: 1, textAlign: "center" },
});
