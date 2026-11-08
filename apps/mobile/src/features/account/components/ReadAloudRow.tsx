import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { toastError } from "@/components/ui/toast";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, space } from "@/lib/theme";

import { useReadAloudSetting } from "../hooks/useReadAloudSetting";
import { Section } from "./Section";

/** The "Read replies out loud" switch, saved in his account like on the web. */
export function ReadAloudRow() {
  const { colors } = useTheme();
  const { isEnabled, isLoaded, setEnabled } = useReadAloudSetting();
  const iconSize = useScaledSize(24);

  const handleChange = async (isOn: boolean) => {
    void Haptics.selectionAsync();
    try {
      await setEnabled(isOn);
    } catch (error) {
      toastError("Couldn't save the setting", error);
    }
  };

  return (
    <Section title="Voice">
      <Card style={styles.card}>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Read replies out loud"
          accessibilityState={{ checked: isEnabled, disabled: !isLoaded }}
          accessibilityHint="The mic answers you with a voice, not just on screen."
          disabled={!isLoaded}
          onPress={() => handleChange(!isEnabled)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <SymbolView name="speaker.wave.2.fill" size={iconSize} tintColor={colors.primary} />
          <View style={styles.text}>
            <Text variant="label">Read replies out loud</Text>
            <Text variant="caption" tone="muted">
              The mic answers you with a voice, not just on screen.
            </Text>
          </View>
          <Switch
            // The whole row is the switch for VoiceOver; this is just the picture of it
            accessibilityElementsHidden
            importantForAccessibility="no"
            value={isEnabled}
            disabled={!isLoaded}
            onValueChange={handleChange}
            trackColor={{ true: colors.primary }}
          />
        </Pressable>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: space.sm },
  row: { minHeight: minTapSize, flexDirection: "row", alignItems: "center", gap: space.md },
  text: { flex: 1, gap: 2 },
});
