import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * True only inside the iOS shell when its build includes the native plugin `name`. The same site
 * also runs in browsers, the installed PWA and older shell builds without newer plugins, so every
 * plugin call must check this first and otherwise keep the web behaviour.
 */
export function isNativePluginAvailable(name: string) {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(name);
}

/**
 * Hides the native launch screen once the site has painted (capacitor.config.ts keeps it up
 * until then, with a 10 s auto-hide as the safety net). Does nothing outside the shell.
 */
export function hideNativeSplash() {
  if (!isNativePluginAvailable("SplashScreen")) return;
  SplashScreen.hide().catch((error: unknown) => console.warn("Hiding the splash failed:", error));
}
