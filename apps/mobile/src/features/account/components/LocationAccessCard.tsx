import { SymbolView } from "expo-symbols";
import { Linking, StyleSheet, View } from "react-native";
import type { SFSymbol } from "expo-symbols";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { useIsLargeText } from "@/hooks/useIsLargeText";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";
import type { ThemeColors } from "@/lib/theme";

import { useLocationStatus } from "../hooks/useLocationStatus";
import type { LocationStatus } from "../hooks/useLocationStatus";
import { Section } from "./Section";

interface StatusCopy {
  title: string;
  detail: string;
  icon: SFSymbol;
  color: keyof ThemeColors;
}

const COPY: Record<Exclude<LocationStatus, "checking">, StatusCopy> = {
  granted: {
    title: "Location is allowed",
    detail: "Today's route can start from where you are, and the map can show you.",
    icon: "location.fill",
    color: "success",
  },
  undetermined: {
    title: "Location isn't turned on yet",
    detail: "Allow it so today's route can start from where you are.",
    icon: "location",
    color: "mutedForeground",
  },
  denied: {
    title: "Location is not allowed",
    detail: "To turn it on, open Settings, tap Location and pick While Using the App.",
    icon: "location.slash.fill",
    color: "destructive",
  },
  "services-off": {
    title: "Location Services is off",
    detail: "Turn it on in Settings > Privacy & Security > Location Services.",
    icon: "location.slash.fill",
    color: "destructive",
  },
};

/** Whether the app may use his location, and how to change it. */
export function LocationAccessCard() {
  const { colors } = useTheme();
  const { status, isRequesting, request } = useLocationStatus();
  const iconSize = useScaledSize(24);
  // At the accessibility sizes the icon sits above the text, which then gets the full width
  const isStacked = useIsLargeText();

  const handleOpenSettings = () => {
    Linking.openSettings().catch((error: unknown) => {
      console.warn("Opening Settings failed:", error);
      toast.error("Couldn't open Settings", { description: "Open the Settings app yourself." });
    });
  };

  if (status === "checking") return null;

  const copy = COPY[status];

  return (
    <Section title="Location">
      <Card>
        <View
          style={[styles.row, isStacked && styles.stacked]}
          accessible
          accessibilityLabel={`${copy.title}. ${copy.detail}`}
        >
          <SymbolView name={copy.icon} size={iconSize} tintColor={colors[copy.color]} />
          <View style={styles.text}>
            <Text variant="label">{copy.title}</Text>
            <Text variant="caption" tone="muted">
              {copy.detail}
            </Text>
          </View>
        </View>
        {status === "undetermined" ?
          <Button title="Allow location" isLoading={isRequesting} onPress={request} />
        : <Button
            title="Open Settings"
            variant={status === "granted" ? "secondary" : "primary"}
            onPress={handleOpenSettings}
          />
        }
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingBottom: space.xs },
  stacked: { flexDirection: "column", alignItems: "flex-start", gap: space.sm },
  text: { flexGrow: 1, flexShrink: 1, gap: 2 },
});
