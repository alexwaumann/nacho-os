import { useSignIn } from "@clerk/expo";
import { useRef, useState } from "react";
import type { ComponentRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { TextInput } from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { getSignInErrorMessage } from "@/features/auth/lib/signInError";
import { space } from "@/lib/theme";

/**
 * Username + password sign-in (the only sign-in the Clerk instance allows). Once the session is
 * active, the root layout's guard swaps this screen for the tabs.
 */
export default function SignInScreen() {
  const { signIn, fetchStatus } = useSignIn();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isSubmitting || fetchStatus === "fetching";
  const canSubmit = username.trim() !== "" && password !== "" && !isBusy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(undefined);
    setIsSubmitting(true);
    try {
      const { error: passwordError } = await signIn.password({
        identifier: username.trim(),
        password,
      });
      if (passwordError) {
        setError(getSignInErrorMessage(passwordError));
        return;
      }

      if (signIn.status !== "complete") {
        // e.g. a second factor; the instance doesn't use any today
        console.warn("Sign-in needs another step:", signIn.status);
        setError("This account needs a sign-in step the app doesn't support yet.");
        return;
      }

      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) setError(getSignInErrorMessage(finalizeError));
    } catch (unexpected) {
      console.error("Sign in failed:", unexpected);
      setError(getSignInErrorMessage(unexpected));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets>
      <View style={styles.header}>
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          accessibilityIgnoresInvertColors
        />
        <Text variant="title">Nacho OS</Text>
        <Text tone="muted" style={styles.center}>
          Sign in with your username and password.
        </Text>
      </View>

      <TextField
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        error={error}
      />

      <Button title="Sign in" isLoading={isBusy} disabled={!canSubmit} onPress={handleSubmit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xxl * 2, gap: space.xl },
  header: { alignItems: "center", gap: space.sm, marginBottom: space.md },
  center: { textAlign: "center" },
  logo: { width: 96, height: 96, borderRadius: 22, borderCurve: "continuous" },
});
