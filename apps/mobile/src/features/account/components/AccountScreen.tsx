import { useClerk, useUser } from "@clerk/expo";
import Constants from "expo-constants";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { StatusBarScrim } from "@/components/StatusBarScrim";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

import { AppearancePicker } from "./AppearancePicker";
import { HomeAddressCard } from "./HomeAddressCard";
import { LocationAccessCard } from "./LocationAccessCard";
import { ReadAloudRow } from "./ReadAloudRow";

const appVersion = Constants.expoConfig?.version;

/** Account: who is signed in, appearance, voice, home address, location access and Sign out. */
export function AccountScreen() {
  const { colors } = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const avatarSize = useScaledSize(48);

  const name = user?.fullName || user?.username || "Signed in";
  const username = user?.username && user.username !== name ? user.username : undefined;

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll need your username and password to sign back in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await signOut();
          } catch (error) {
            console.error("Sign out failed:", error);
            setIsSigningOut(false);
            Alert.alert("Couldn't sign out", "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <>
      <Screen contentContainerStyle={styles.content}>
        <Card
          style={styles.profile}
          accessible
          accessibilityLabel={`Signed in as ${name}${username ? `, username ${username}` : ""}`}
        >
          <SymbolView
            name="person.crop.circle.fill"
            size={avatarSize}
            tintColor={colors.mutedForeground}
          />
          <View style={styles.profileText}>
            <Text variant="caption" tone="muted">
              Signed in as
            </Text>
            <Text variant="heading">{name}</Text>
            {username ?
              <Text tone="muted">{username}</Text>
            : null}
          </View>
        </Card>

        <AppearancePicker />
        <ReadAloudRow />
        <HomeAddressCard />
        <LocationAccessCard />

        <View style={styles.footer}>
          <Button
            title="Sign out"
            variant="secondary"
            isLoading={isSigningOut}
            onPress={handleSignOut}
          />
          {appVersion ?
            <Text variant="footnote" tone="muted" style={styles.version}>
              Nacho OS {appVersion}
            </Text>
          : null}
        </View>
      </Screen>
      <StatusBarScrim />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.xl, paddingBottom: space.xxl },
  profile: { flexDirection: "row", alignItems: "center", gap: space.md },
  profileText: { flex: 1, gap: 2 },
  footer: { gap: space.md },
  version: { textAlign: "center" },
});
