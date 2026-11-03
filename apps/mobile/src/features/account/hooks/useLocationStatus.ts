import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Where location access stands for the app:
 * - `checking`: not known yet
 * - `granted`: allowed
 * - `undetermined`: never asked; asking shows the iOS prompt
 * - `denied`: turned down; only the Settings app can change it now
 * - `services-off`: Location Services is off for the whole phone
 */
export type LocationStatus = "checking" | "granted" | "undetermined" | "denied" | "services-off";

async function readStatus(): Promise<LocationStatus> {
  if (!(await Location.hasServicesEnabledAsync())) return "services-off";
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) return "granted";
  if (status === Location.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

/**
 * The app's location access, checked again whenever the app comes back to the front (e.g. after
 * he changes it in Settings). `request` shows the iOS prompt when it hasn't been asked yet.
 */
export function useLocationStatus() {
  const [status, setStatus] = useState<LocationStatus>("checking");
  const [isRequesting, setIsRequesting] = useState(false);

  const refresh = useCallback(() => {
    readStatus()
      .then(setStatus)
      .catch((error: unknown) => console.warn("Checking location access failed:", error));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const request = async () => {
    setIsRequesting(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch (error) {
      console.warn("Asking for location failed:", error);
    } finally {
      setIsRequesting(false);
      refresh();
    }
  };

  return { status, isRequesting, request };
}
