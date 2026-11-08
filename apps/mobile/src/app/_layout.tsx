import { useAuth } from "@clerk/expo";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Toaster } from "@/components/ui/toast";
import { singleJobSheetRouter } from "@/features/job-detail/lib/singleJobSheet";
import { useOpenAddJobForOpenedFiles } from "@/features/open-in/hooks/useOpenedFiles";
import { useTheme } from "@/hooks/useTheme";
import { AppProviders } from "@/integrations/providers";

// Keep the launch screen up until Clerk knows whether he is signed in
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function RootLayout() {
  return (
    // Once, around the whole app, as react-native-gesture-handler asks (Today's drag and swipe)
    <GestureHandlerRootView style={styles.root}>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();
  const { scheme, colors } = useTheme();
  // "Open in Nacho OS": a PDF shared from Mail or Files opens Add Job (see +native-intent.tsx)
  useOpenAddJobForOpenedFiles(!!isSignedIn);

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
      {/* One job sheet at a time: opening a job (a tap, voice, a nachoos://job/<id> link) while
          a sheet is up shows it in that sheet instead of stacking a second one */}
      <Stack screenOptions={{ headerShown: false }} UNSTABLE_router={singleJobSheetRouter}>
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
          <Stack.Screen name="scan-receipt" options={{ presentation: "modal" }} />
          <Stack.Screen name="scan-check" options={{ presentation: "modal" }} />
          <Stack.Screen name="edit-route" options={{ presentation: "modal" }} />
          <Stack.Screen
            name="add-job"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.75, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="image-viewer"
            options={{ presentation: "fullScreenModal", animation: "fade" }}
          />
          <Stack.Screen name="pdf-viewer" options={{ presentation: "fullScreenModal" }} />
        </Stack.Protected>

        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      <Toaster />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
