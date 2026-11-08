import { Stack } from "expo-router";
import type { ReactNode } from "react";

import { useTheme } from "@/hooks/useTheme";

interface TabStackProps {
  /** Name of the tab's first screen; the Back button of screens pushed from it shows it */
  title: string;
  /** `<Stack.Screen>`s for the tab's other screens that need options */
  children?: ReactNode;
}

/**
 * The Stack inside each tab. The tab's first screen has no header (the tab bar already says
 * where you are): its content starts under the status bar, with a `StatusBarScrim` over it.
 * Screens pushed from it get a normal small header with a Back button.
 */
export function TabStack({ title, children }: TabStackProps) {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.foreground },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title, headerShown: false }} />
      {children}
    </Stack>
  );
}
