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

const headerVariants: ReadonlySet<TextVariant> = new Set([
  "largeTitle",
  "title",
  "title2",
  "heading",
]);

/**
 * Text in the app's type scale (Apple's text styles, see `typography`). Grows with Dynamic Type
 * (the iOS text size setting) like the matching iOS style. Use this instead of React Native's Text.
 */
export function Text({ variant = "body", tone = "default", style, ...props }: TextProps) {
  const { colors } = useTheme();
  const { maxScale, ...type } = typography[variant];

  return (
    <NativeText
      maxFontSizeMultiplier={maxScale}
      accessibilityRole={headerVariants.has(variant) ? "header" : undefined}
      style={[type, { color: colors[toneColor[tone]] }, style]}
      {...props}
    />
  );
}
