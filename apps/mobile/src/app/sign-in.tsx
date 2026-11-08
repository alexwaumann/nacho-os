import { useClerk, useSignIn } from "@clerk/expo";
import { useRef, useState } from "react";
import type { ComponentRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { TextInput } from "react-native";

import {
  canResendCode,
  getSignInStep,
  sendSignInCode,
  verifySignInCode,
} from "@shared/auth/signInSteps";
import type { SignInCodeStep as CodeStep } from "@shared/auth/signInSteps";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { NewPasswordStep } from "@/features/auth/components/NewPasswordStep";
import { SignInCodeStep } from "@/features/auth/components/SignInCodeStep";
import { getSignInErrorCode, getSignInErrorMessage } from "@/features/auth/lib/signInError";
import { space } from "@/lib/theme";

/** What's on screen: the password form, or a step Clerk asked for after it */
type SignInView = { kind: "password" } | CodeStep | { kind: "new_password" };

/**
 * Username + password sign-in (the only sign-in the Clerk instance allows), plus any step Clerk
 * asks for after the password: a code by email or text (e.g. a new device), an authenticator or
 * backup code, or a new password (see getSignInStep). Once the session is active, the root
 * layout's guard swaps this screen for the tabs.
 */
export default function SignInScreen() {
  const { signIn, fetchStatus } = useSignIn();
  const clerk = useClerk();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [view, setView] = useState<SignInView>({ kind: "password" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBusy = isSubmitting || fetchStatus === "fetching";
  const canSubmit = username.trim() !== "" && password !== "" && !isBusy;

  /** Runs a Clerk call with the spinner up, showing a plain message if it fails */
  const run = async (task: () => Promise<void>) => {
    setError(undefined);
    setNotice(undefined);
    setIsSubmitting(true);
    try {
      await task();
    } catch (unexpected) {
      console.error("Sign in failed:", unexpected);
      setError(getSignInErrorMessage(unexpected));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Back to the password form, with a fresh sign-in */
  const startOver = async (message?: string) => {
    await signIn.reset();
    setPassword("");
    setView({ kind: "password" });
    setError(message);
  };

  /** After Clerk accepted something: finish signing in, or show the step it asks for next */
  const continueSignIn = async () => {
    const next = getSignInStep(signIn);
    if (next.kind === "done") {
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) setError(getSignInErrorMessage(finalizeError));
      return;
    }
    if (next.kind === "unsupported") {
      console.warn("Sign-in needs a step the app can't do:", next.status);
      await startOver(next.message);
      return;
    }
    setView(next);
    if (next.kind === "code" && canResendCode(next)) {
      const { error: sendError } = await sendSignInCode(signIn, next);
      if (sendError) setError(getSignInErrorMessage(sendError));
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    void run(async () => {
      const { error: passwordError } = await signIn.password({
        identifier: username.trim(),
        password,
      });
      // This phone already has his session but it was never switched on (e.g. the last sign-in
      // was cut off just before the end): use it instead of saying "You're already signed in."
      const existingSession = clerk.client?.sessions.find(
        (session) => session.user?.username?.toLowerCase() === username.trim().toLowerCase(),
      );
      if (getSignInErrorCode(passwordError) === "session_exists" && existingSession) {
        await clerk.setActive({ session: existingSession.id });
        return;
      }
      if (passwordError) {
        setError(getSignInErrorMessage(passwordError));
        return;
      }
      await continueSignIn();
    });
  };

  const handleCode = (step: CodeStep, code: string) => {
    void run(async () => {
      const { error: codeError } = await verifySignInCode(signIn, step, code);
      if (codeError) {
        setError(getSignInErrorMessage(codeError));
        return;
      }
      await continueSignIn();
    });
  };

  const handleResend = (step: CodeStep) => {
    void run(async () => {
      const { error: sendError } = await sendSignInCode(signIn, step);
      if (sendError) setError(getSignInErrorMessage(sendError));
      else setNotice("We sent a new code.");
    });
  };

  const handleNewPassword = (newPassword: string) => {
    void run(async () => {
      const { error: passwordError } = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
      });
      if (passwordError) {
        setError(getSignInErrorMessage(passwordError));
        return;
      }
      await continueSignIn();
    });
  };

  const handleBack = () => {
    void run(() => startOver());
  };

  return (
    <Screen contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets>
      {view.kind === "code" ?
        <SignInCodeStep
          // A new step (e.g. a second factor after a first) starts with an empty field
          key={`${view.stage}-${view.method}`}
          step={view}
          error={error}
          notice={notice}
          isBusy={isBusy}
          onSubmit={(code) => handleCode(view, code)}
          onResend={() => handleResend(view)}
          onBack={handleBack}
        />
      : view.kind === "new_password" ?
        <NewPasswordStep
          error={error}
          isBusy={isBusy}
          onSubmit={handleNewPassword}
          onBack={handleBack}
        />
      : <>
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
        </>
      }
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xxl * 2, gap: space.xl },
  header: { alignItems: "center", gap: space.sm, marginBottom: space.md },
  center: { textAlign: "center" },
  logo: { width: 96, height: 96, borderRadius: 22, borderCurve: "continuous" },
});
