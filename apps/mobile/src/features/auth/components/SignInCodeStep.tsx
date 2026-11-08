import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { canResendCode, describeCodeStep } from "@shared/auth/signInSteps";
import type { SignInCodeStep as CodeStep } from "@shared/auth/signInSteps";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { space } from "@/lib/theme";

const titleForMethod: Record<CodeStep["method"], string> = {
  email_code: "Check your email",
  phone_code: "Check your messages",
  totp: "Enter your code",
  backup_code: "Enter a backup code",
};

interface SignInCodeStepProps {
  step: CodeStep;
  error?: string;
  /** e.g. "We sent a new code." after Resend */
  notice?: string;
  isBusy: boolean;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
}

/**
 * "Enter the code we sent to …": the extra step Clerk can ask for after the password (a new
 * device, a second factor). iOS offers the code from Mail or Messages above the keyboard.
 */
export function SignInCodeStep({
  step,
  error,
  notice,
  isBusy,
  onSubmit,
  onResend,
  onBack,
}: SignInCodeStepProps) {
  const [code, setCode] = useState("");

  const isBackupCode = step.method === "backup_code";
  const canSubmit = code.trim() !== "" && !isBusy;

  const handleSubmit = () => {
    if (canSubmit) onSubmit(code);
  };

  const handleResend = () => {
    setCode("");
    onResend();
  };

  return (
    <>
      <View style={styles.header}>
        <Text variant="title" style={styles.center}>
          {titleForMethod[step.method]}
        </Text>
        <Text tone="muted" style={styles.center}>
          {describeCodeStep(step)}
        </Text>
      </View>

      <TextField
        label="Code"
        value={code}
        onChangeText={setCode}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={isBackupCode ? "default" : "number-pad"}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        error={error}
      />
      {notice && !error ?
        <Text variant="caption" tone="muted">
          {notice}
        </Text>
      : null}

      <Button title="Continue" isLoading={isBusy} disabled={!canSubmit} onPress={handleSubmit} />
      <View style={styles.links}>
        {canResendCode(step) ?
          <Button title="Resend code" variant="ghost" disabled={isBusy} onPress={handleResend} />
        : null}
        <Button title="Back" variant="ghost" disabled={isBusy} onPress={onBack} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: space.sm, marginBottom: space.md },
  center: { textAlign: "center" },
  links: { gap: space.xs },
});
