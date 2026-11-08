import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { PlaceSuggestion } from "@convex/lib/routing";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { toast, toastError } from "@/components/ui/toast";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, space } from "@/lib/theme";

import { usePlaceSuggestions } from "../hooks/usePlaceSuggestions";

/**
 * Search for his home address and save the one he picks: it is looked up on the map (for route
 * planning) and saved to his account, then the screen goes back to Account.
 */
export function HomeAddressSearch() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const geocodeAddress = useAction(api.maps.geocodeAddress);
  const updateHomeAddress = useMutation(api.users.updateHomeAddress);

  const pinSize = useScaledSize(24);
  const [query, setQuery] = useState("");
  const [savingPlaceId, setSavingPlaceId] = useState<string>();
  const { suggestions, isSearching, hasError, isSearchable } = usePlaceSuggestions(
    query,
    user?.homeCoordinates ?? undefined,
  );

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    if (savingPlaceId) return;
    setSavingPlaceId(suggestion.placeId);
    try {
      const coordinates = await geocodeAddress({ address: suggestion.label });
      if (!coordinates) {
        // Without a point on the map, routes couldn't start from home, so don't save it
        toast.error("Couldn't find that address on the map", {
          description: "Try typing it a little differently.",
        });
        return;
      }
      await updateHomeAddress({ address: suggestion.label, coordinates });
      toast.success("Home address saved", { description: suggestion.label });
      router.back();
    } catch (error) {
      toastError("Couldn't save the address", error);
    } finally {
      setSavingPlaceId(undefined);
    }
  };

  return (
    <Screen automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag">
      <TextField
        label="New home address"
        placeholder="Start typing the address"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        returnKeyType="search"
        clearButtonMode="while-editing"
        editable={!savingPlaceId}
      />

      {!isSearchable ?
        <View style={styles.idle}>
          <Text tone="muted">Type the street and number, then pick it from the list.</Text>
          {user?.homeAddress ?
            <View style={styles.current}>
              <Text variant="caption" tone="muted">
                Your home address now
              </Text>
              <Text>{user.homeAddress}</Text>
            </View>
          : null}
        </View>
      : suggestions.length > 0 ?
        <Card style={styles.list}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={suggestion.placeId}
              accessibilityRole="button"
              accessibilityLabel={suggestion.label}
              accessibilityHint="Saves this as your home address"
              accessibilityState={{ busy: savingPlaceId === suggestion.placeId }}
              disabled={!!savingPlaceId}
              onPress={() => handleSelect(suggestion)}
              style={({ pressed }) => [
                styles.suggestion,
                index > 0 && [styles.divider, { borderTopColor: colors.border }],
                {
                  opacity:
                    pressed ? 0.6
                    : savingPlaceId && savingPlaceId !== suggestion.placeId ? 0.4
                    : 1,
                },
              ]}
            >
              <SymbolView name="mappin.circle.fill" size={pinSize} tintColor={colors.primary} />
              <View style={styles.suggestionText}>
                <Text variant="label">{suggestion.mainText ?? suggestion.label}</Text>
                {suggestion.secondaryText ?
                  <Text variant="caption" tone="muted">
                    {suggestion.secondaryText}
                  </Text>
                : null}
              </View>
              {savingPlaceId === suggestion.placeId ?
                <ActivityIndicator color={colors.primary} />
              : null}
            </Pressable>
          ))}
        </Card>
      : isSearching ?
        <ActivityIndicator color={colors.mutedForeground} style={styles.searching} />
      : <Text tone="muted">
          {hasError ?
            "Couldn't look up addresses. Check your signal, then try again."
          : "No addresses found. Check the spelling."}
        </Text>
      }
    </Screen>
  );
}

const styles = StyleSheet.create({
  idle: { gap: space.xl },
  current: { gap: space.xs },
  list: { paddingVertical: 0, gap: 0 },
  suggestion: {
    minHeight: minTapSize + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm + 2,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  suggestionText: { flex: 1, gap: 2 },
  searching: { paddingVertical: space.lg },
});
