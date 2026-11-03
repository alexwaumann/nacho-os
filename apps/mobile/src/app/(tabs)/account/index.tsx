import { useClerk, useUser } from "@clerk/expo";
import { useState } from "react";
import { Alert } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";

/** Account: who is signed in, and Sign out. The Account PR adds the rest. */
export default function AccountScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    <Screen>
      <Card>
        <Text variant="caption" tone="muted">
          Signed in as
        </Text>
        <Text variant="heading">{name}</Text>
        {username ?
          <Text tone="muted">{username}</Text>
        : null}
      </Card>
      <Button
        title="Sign out"
        variant="secondary"
        isLoading={isSigningOut}
        onPress={handleSignOut}
      />
    </Screen>
  );
}
