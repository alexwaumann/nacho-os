import { Capacitor } from "@capacitor/core";

/**
 * True only inside the iOS shell when its build includes the native plugin `name`. The same site
 * also runs in browsers, the installed PWA and older shell builds without newer plugins, so every
 * plugin call must check this first and otherwise keep the web behaviour.
 */
export function isNativePluginAvailable(name: string) {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(name);
}

