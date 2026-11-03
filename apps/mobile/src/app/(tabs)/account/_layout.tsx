import { Stack } from "expo-router";

import { TabStack } from "@/components/TabStack";
import { useTheme } from "@/hooks/useTheme";

export default function AccountLayout() {
  const { colors } = useTheme();

  return (
    <TabStack title="Account">
      {/* A plain (not see-through) header, so the search field's label isn't drawn under it */}
      <Stack.Screen
        name="home-address"
        options={{
          title: "Home address",
          headerLargeTitle: false,
          headerTransparent: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
    </TabStack>
  );
}
