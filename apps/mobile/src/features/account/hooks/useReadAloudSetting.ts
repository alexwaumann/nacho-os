import { useConvexAuth, useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { isReadingRepliesAloud } from "@shared/users/settings";

/**
 * "Read replies out loud" (Account → Voice), kept in his Convex user settings like on the web, so
 * the choice follows him between the website and the app.
 *
 * - `isEnabled`: on unless he turned it off (also on while loading).
 * - `isLoaded`: false until his user row has loaded; the switch is disabled until then.
 * - `setEnabled`: saves the choice, updating the screen right away. Throws if saving fails.
 */
export function useReadAloudSetting() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const updateSettings = useMutation(api.users.updateSettings).withOptimisticUpdate(
    (localStore, { settings }) => {
      const current = localStore.getQuery(api.users.getCurrentUser, {});
      if (!current) return;
      localStore.setQuery(
        api.users.getCurrentUser,
        {},
        { ...current, settings: { ...current.settings, ...settings } },
      );
    },
  );

  const setEnabled = async (isOn: boolean) => {
    await updateSettings({ settings: { readRepliesAloud: isOn } });
  };

  return {
    isEnabled: isReadingRepliesAloud(user?.settings),
    isLoaded: !!user,
    setEnabled,
  };
}
