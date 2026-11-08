import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { space } from "@/lib/theme";

interface NewPasswordStepProps {
  error?: string;
  isBusy: boolean;
  onSubmit: (password: string) => void;
  onBack: () => void;
}

/** Clerk's "needs_new_password" step: he picks a new password, then he's signed in. */
export function NewPasswordStep({ error, isBusy, onSubmit, onBack }: NewPasswordStepProps) {
  const [password, setPassword] = useState("");

  const canSubmit = password !== "" && !isBusy;

  const handleSubmit = () => {
    if (canSubmit) onSubmit(password);
  };

  return (
    <>
      <View style={styles.header}>
        <Text variant="title" style={styles.center}>
          Choose a new password
        </Text>
        <Text tone="muted" style={styles.center}>
          You need a new password to sign in.
        </Text>
      </View>

      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        autoFocus
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        error={error}
      />

      <Button
        title="Save and sign in"
        isLoading={isBusy}
        disabled={!canSubmit}
        onPress={handleSubmit}
      />
      <Button title="Back" variant="ghost" disabled={isBusy} onPress={onBack} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: space.sm, marginBottom: space.md },
  center: { textAlign: "center" },
});
