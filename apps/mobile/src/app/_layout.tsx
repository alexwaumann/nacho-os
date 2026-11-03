import { useAuth } from "@clerk/expo";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { Toaster } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { AppProviders } from "@/integrations/providers";

// Keep the launch screen up until Clerk knows whether he is signed in
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const { scheme, colors } = useTheme();

  useEffect(() => {
    if (isLoaded) SplashScreen.hide();
  }, [isLoaded]);

  const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
    },
  };

  if (!isLoaded) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Signed in: the tabs, and screens presented over them */}
        <Stack.Protected guard={!!isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="job/[id]"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </Stack.Protected>

        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      <Toaster />
    </ThemeProvider>
  );
}
