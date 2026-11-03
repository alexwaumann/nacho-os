import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { Text } from "@/components/ui/text";
import { space } from "@/lib/theme";

interface SectionProps {
  title: string;
  /** Explains the section, under its content */
  footer?: string;
  children: ReactNode;
}

/** A titled group of settings, like a grouped section in the iOS Settings app. */
export function Section({ title, footer, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="muted" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
      {footer ?
        <Text variant="caption" tone="muted" style={styles.footer}>
          {footer}
        </Text>
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  title: { paddingHorizontal: space.xs },
  footer: { paddingHorizontal: space.xs },
});
