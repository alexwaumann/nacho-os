import { Stack } from "expo-router";

import { TabStack } from "@/components/TabStack";

export default function AccountLayout() {
  return (
    <TabStack title="Account">
      <Stack.Screen name="home-address" options={{ title: "Home address" }} />
    </TabStack>
  );
}
