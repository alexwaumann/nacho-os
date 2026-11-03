import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";

import { Text } from "@/components/ui/text";
import type { TextTone } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  title: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A full-width button at least 56 pt tall, with a spinner while `isLoading`. */
export function Button({
  title,
  variant = "primary",
  isLoading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || isLoading;

  const background = {
    primary: colors.primary,
    secondary: colors.muted,
    destructive: colors.destructive,
    ghost: "transparent",
  }[variant];
  const tone: TextTone = {
    primary: "onPrimary" as const,
    secondary: "default" as const,
    destructive: "onPrimary" as const,
    ghost: "primary" as const,
  }[variant];
  const textColor = variant === "destructive" ? colors.destructiveForeground : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          opacity:
            isDisabled ? 0.5
            : pressed ? 0.75
            : 1,
        },
        style,
      ]}
      {...props}
    >
      {isLoading ?
        <ActivityIndicator color={textColor ?? colors.primaryForeground} />
      : <Text
          variant="label"
          tone={tone}
          style={textColor ? { color: textColor } : undefined}
          numberOfLines={2}
        >
          {title}
        </Text>
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTapSize,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
