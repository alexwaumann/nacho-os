import { useEffect } from "react";

import { hideNativeSplash } from "@/lib/native";

/**
 * Uncovers the iOS app's launch screen once this renders, i.e. once Clerk knows whether he is
 * signed in and the page (or the sign-in form) is on screen. Renders nothing; no-op on the web.
 */
export function HideNativeSplash() {
  useEffect(() => {
    // Two frames: the first runs before the browser paints this render, the second after it
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(hideNativeSplash);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
