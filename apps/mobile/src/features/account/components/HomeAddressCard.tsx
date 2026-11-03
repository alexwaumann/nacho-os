import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

import { Section } from "./Section";

/** His home address (where routes start and end), with a button to change it. */
export function HomeAddressCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");

  const homeAddress = user?.homeAddress;

  return (
    <Section
      title="Home address"
      footer="Route optimization will start and end from this location."
    >
      <Card>
        {user === undefined ?
          <ActivityIndicator color={colors.mutedForeground} style={styles.loading} />
        : <View
            style={styles.row}
            accessible
            accessibilityLabel={homeAddress ? `Home: ${homeAddress}` : "No home address yet"}
          >
            <SymbolView
              name={homeAddress ? "house.fill" : "house"}
              size={28}
              tintColor={homeAddress ? colors.primary : colors.mutedForeground}
            />
            <Text style={styles.address} tone={homeAddress ? "default" : "muted"}>
              {homeAddress ?? "No home address yet"}
            </Text>
          </View>
        }
        <Button
          title={homeAddress ? "Change home address" : "Add home address"}
          variant={homeAddress ? "secondary" : "primary"}
          disabled={user === undefined}
          onPress={() => router.push("/account/home-address")}
        />
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingBottom: space.xs },
  address: { flex: 1 },
});
