import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { SectionLabel } from "@/components/ui/section";
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
      <SectionLabel style={styles.title}>{title}</SectionLabel>
      {children}
      {footer ?
        <Text variant="footnote" tone="muted" style={styles.footer}>
          {footer}
        </Text>
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  title: { paddingHorizontal: space.lg },
  footer: { paddingHorizontal: space.lg },
});
