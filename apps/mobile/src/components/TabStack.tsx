import { Stack } from "expo-router";

import { useTheme } from "@/hooks/useTheme";

interface TabStackProps {
  /** Large title of the tab's first screen */
  title: string;
}

/** The Stack inside each tab: a native large-title header that collapses on scroll. */
export function TabStack({ title }: TabStackProps) {
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
    </Stack>
  );
}
