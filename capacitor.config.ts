import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS shell for Nacho OS. The app is not bundled: the web view loads the deployed site
 * (server functions need the TanStack Start server), so `webDir` is only a placeholder page.
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
    // Keep Clerk pages (hosted sign-in / account portal redirects) inside the web view. Any other
    // host (e.g. Google Maps links) is handed to iOS by Capacitor and opens outside the app.
    allowNavigation: ["unbiased-cowbird-38.clerk.accounts.dev", "unbiased-cowbird-38.accounts.dev"],
  },
  ios: {
    // The site has no `viewport-fit=cover`, so let iOS keep content clear of the status bar
    // and home indicator instead of drawing underneath them.
    contentInset: "always",
  },
};

export default config;
