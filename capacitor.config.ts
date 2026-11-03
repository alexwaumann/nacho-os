import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS shell for Nacho OS. The app is not bundled: the web view loads the deployed site, so
 * a web deploy reaches the app without a new native build, and `webDir` is only the offline page.
 *
 * Point the shell at a dev server with e.g.
 * `CAP_SERVER_URL=https://alex-macbook-pro.tailf22ce6.ts.net:3000 bun run ios:sync`.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://nacho-os.netlify.app";

const config: CapacitorConfig = {
  appId: "com.waumann.nachoos",
  appName: "Nacho OS",
  webDir: "native/www",
  server: {
    url: serverUrl,
    // Without this a failed load (e.g. no signal at launch) leaves a blank screen. The page is
    // served from `webDir` and has a "Try again" button back to the site.
    errorPath: "index.html",
    // Keep Clerk pages (hosted sign-in / account portal redirects) inside the web view. Any other
    // host (e.g. Google Maps links) is handed to iOS by Capacitor and opens outside the app.
    allowNavigation: ["unbiased-cowbird-38.clerk.accounts.dev", "unbiased-cowbird-38.accounts.dev"],
  },
  ios: {
    // The site has no `viewport-fit=cover`, so let iOS keep content clear of the status bar
    // and home indicator instead of drawing underneath them.
    contentInset: "always",
    // No `backgroundColor`: the web view's colour also fills the status bar strip above the page
    // for good, so brand blue there looked wrong. The default (white / black in dark mode)
    // matches the site, and the splash below covers the load itself.
  },
  plugins: {
    SplashScreen: {
      // Keep the launch screen (same storyboard as the native splash) up until the site calls
      // `SplashScreen.hide()` once it has rendered (see `src/lib/native.ts`), instead of showing
      // a blank web view while it loads. The plugin has no "wait for hide()" with a maximum, so
      // auto-hide stays on with a long duration as the safety net: a site build without the
      // hide() call, or a launch that never gets that far, still shows the page after 6 s.
      launchAutoHide: true,
      launchShowDuration: 6000,
      backgroundColor: "#0085c8",
      showSpinner: false,
    },
  },
};

export default config;
