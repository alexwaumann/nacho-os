import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { getHourStart, msUntilNextHour } from "@shared/jobs/forecast";

/**
 * Start of the current hour (ms), updated when the clock rolls over to the next hour. Also
 * re-checks when the app comes back to the foreground, since iOS pauses timers in the background.
 */
export function useCurrentHour() {
  const [hourStart, setHourStart] = useState(getHourStart);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      setHourStart(getHourStart());
      clearTimeout(timeout);
      timeout = setTimeout(sync, msUntilNextHour());
    };

    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, []);

  return hourStart;
}
