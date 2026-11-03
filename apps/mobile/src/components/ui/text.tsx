import { Text as NativeText } from "react-native";
import type { TextProps as NativeTextProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { typography } from "@/lib/theme";
import type { TextVariant, ThemeColors } from "@/lib/theme";

export type TextTone = "default" | "muted" | "primary" | "destructive" | "onPrimary";

export interface TextProps extends NativeTextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

const toneColor: Record<TextTone, keyof ThemeColors> = {
  default: "foreground",
  muted: "mutedForeground",
  primary: "primary",
  destructive: "destructive",
  onPrimary: "primaryForeground",
};

/**
 * Text in the app's type scale. Grows with Dynamic Type (the iOS text size setting) up to the
 * variant's cap. Use this instead of React Native's Text.
 */
export function Text({ variant = "body", tone = "default", style, ...props }: TextProps) {
  const { colors } = useTheme();
  const { maxScale, ...type } = typography[variant];

  return (
    <NativeText
      maxFontSizeMultiplier={maxScale}
      accessibilityRole={variant === "title" || variant === "heading" ? "header" : undefined}
      style={[type, { color: colors[toneColor[tone]] }, style]}
      {...props}
    />
  );
}
