import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

import { Text } from "@/components/ui/text";
import { space } from "@/lib/theme";

interface SectionLabelProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

/** A small, bold, upper-case heading over a group, e.g. "STATUS" or "ON TODAY'S ROUTE" */
export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <Text variant="caption" tone="muted" style={[styles.label, style]}>
      {children.toUpperCase()}
    </Text>
  );
}

interface SectionProps {
  title: string;
  /** Shown at the right of the heading, e.g. "3 of 5 done" */
  aside?: ReactNode;
  children: ReactNode;
}

/** A block of a sheet with a `SectionLabel` heading */
export function Section({ title, aside, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <SectionLabel>{title}</SectionLabel>
        {aside}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    flexWrap: "wrap",
  },
  label: { fontWeight: "800", letterSpacing: 1.2 },
});
