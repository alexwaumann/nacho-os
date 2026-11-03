import { Stack } from "expo-router";
import type { ReactNode } from "react";

import { useTheme } from "@/hooks/useTheme";

interface TabStackProps {
  /** Large title of the tab's first screen */
  title: string;
  /** `<Stack.Screen>`s for the tab's other screens that need options */
  children?: ReactNode;
}

/** The Stack inside each tab: a native large-title header that collapses on scroll. */
export function TabStack({ title, children }: TabStackProps) {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerTintColor: colors.primary,
        headerLargeTitleStyle: { color: colors.foreground },
        headerTitleStyle: { color: colors.foreground },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
      {children}
    </Stack>
  );
}
