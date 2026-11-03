import { NativeTabs } from "expo-router/native-tabs";

import { useSyncUser } from "@/hooks/useSyncUser";
import { useTheme } from "@/hooks/useTheme";

/**
 * The native iOS tab bar (Liquid Glass on iOS 26+). Each tab is a folder with its own Stack, so
 * it gets a native large-title header and can push screens of its own.
 *
 * Voice: the mic belongs in `<NativeTabs.BottomAccessory>` (iOS 26+: a glass bar that sits above
 * the tab bar on every tab and shrinks inline when the bar minimizes). The Voice PR adds it here.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  useSyncUser();

  return (
    <NativeTabs tintColor={colors.primary} labelStyle={{ fontSize: 12, fontWeight: "600" }}>
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="jobs">
        <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "list.bullet.clipboard", selected: "list.bullet.clipboard.fill" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
