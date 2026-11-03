# iOS app (Capacitor shell)

> A native rewrite is under way in [`apps/mobile`](../apps/mobile/README.md) (Expo, bundle id
> `com.waumann.nachoos.native`, installs next to this app). This shell stays until cutover.

The iOS app is a thin [Capacitor 8](https://capacitorjs.com) wrapper: a native WKWebView that
loads the live site at <https://nacho-os.netlify.app>. Nothing from `dist/` is bundled: the site is
static files on Netlify and everything else (Gemini, voice, weather, geo, route brief) runs in
Convex, so loading it by URL means a web deploy updates the app instantly. A new native build is
only needed when `capacitor.config.ts`, `ios/` or the Capacitor packages change.

- `capacitor.config.ts` – app id `com.waumann.nachoos`, `server.url`, allowed navigation hosts.
- `native/www/` – offline page, shown via `server.errorPath` when the site can't load (no
  signal). Its "Try again" button goes back to the site.
- `ios/` – Xcode project; plugins come in via Swift Package Manager (no CocoaPods).
- `ios/App/App/Info.plist` – display name and camera / microphone / location / photo prompts.

Links to other hosts (e.g. Google Maps directions) are handed to iOS by Capacitor and open in
Google Maps or Safari, so the app stays on its page. Clerk hosts are allowed to load in the app.

## Native plugins

Every plugin call in the site is guarded with `Capacitor.isNativePlatform()` and
`Capacitor.isPluginAvailable()` (`isNativePluginAvailable` in `src/lib/native.ts`), because the same
site also serves browsers, the installed PWA and older app builds without newer plugins. Without
the plugin the site keeps its web behaviour.

- `@capacitor/geolocation` – `src/lib/geolocation.ts` uses it in the app instead of
  `navigator.geolocation`, so iOS asks for location once and WebKit never adds its own
  "… would like to use your current location" alert (which came back on every launch). Errors are
  mapped onto the browser's `GeolocationPositionError` codes. Apple wants
  `NSLocationAlwaysAndWhenInUseUsageDescription` in `Info.plist` for the library it uses, even
  though the app only asks for "while using". The plugin ignores `maximumAge` (every call is a
  fresh fix) and times out after 5 s by default, so `geolocation.ts` keeps the last fix and
  returns it within the caller's `maximumAge`, waits at least 15 s for a new one, and shares one
  plugin call between overlapping requests (e.g. the map and "Optimize route"). The account page
  asks with `requestPermissions()` (the iOS prompt itself), re-checks when the app comes back to
  the foreground (`@capacitor/app`; iOS sends no event when he changes it in Settings) and tells
  him to turn Location Services on when it is off for the whole phone.
- `@capacitor/splash-screen` – keeps the launch screen up until the site has rendered, instead of a
  blank white web view while it loads. `HideNativeSplash` (in `src/routes/__root.tsx`) calls
  `SplashScreen.hide()` once Clerk knows whether he is signed in, and the offline page calls it
  through `window.Capacitor.Plugins`. **Safety net:** the plugin can't wait for `hide()` with a
  maximum, so `launchAutoHide` stays on with `launchShowDuration: 6000`; a site that never calls
  `hide()` (an old deploy, a crash) shows after at most 6 s. Install a new app build only after
  the site with the `hide()` call is deployed, or every launch waits the full 6 s.

After adding a plugin run `bun run ios:sync` (it registers it in `ios/App/CapApp-SPM/Package.swift`)
and rebuild the app.

## Home indicator and fixed elements

With `contentInset: "always"` the page scrolls clear of the status bar and home indicator, but
WebKit still lays out `position: fixed` down to the bottom screen edge and reports
`env(safe-area-inset-bottom)` as 0 (the top is fine: fixed elements start below the status bar).
An inline script in `src/routes/__root.tsx` sets `data-native-shell` on `<html>` and
`--native-safe-bottom: 34px` on devices with a home indicator when running in the app; it is
`0px` everywhere else. It tells them apart by the status bar height (screen height minus
`innerHeight`): over 20 pt means Face ID (iPhones 44 pt+, iPads 24 pt), 20 pt a home button. It
is checked again on `resize` and `pageshow`. Bottom-anchored UI adds it: the bottom nav, the job sheet's mic and padding, the image
viewer controls and the Edit route footer. Use it for any new fixed bottom element.

## App icon and splash

`resources/icon.png` and `resources/splash.png` (built by `scripts/generate-icons.mjs`) feed the
native asset catalog:

```bash
bunx @capacitor/assets generate --ios
rm ios/App/App/Assets.xcassets/Splash.imageset/*-dark.png
node -e 'const f="ios/App/App/Assets.xcassets/Splash.imageset/Contents.json",fs=require("fs"),j=JSON.parse(fs.readFileSync(f));j.images=j.images.filter(i=>!i.appearances);fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")'
cd ios/App/App/Assets.xcassets/Splash.imageset
sips -z 800 800 Default@1x~universal~anyany.png && sips -z 1600 1600 Default@2x~universal~anyany.png
sips -z 2400 2400 Default@3x~universal~anyany.png && cd -
```

The generator always adds a dark-mode splash (the icon on near-black), so the `rm` and `node`
lines remove it again and dark mode keeps the blue brand splash.

The generator also writes the same 2732×2732 image for every scale. iOS refuses to draw a launch
screen it estimates at over 25 MB of memory, and 2732² pixels is about 30 MB, so the phone shows a
black screen instead of the splash. The `sips` lines shrink each scale to 800 / 1600 / 2400 px
(fine with the aspect-fill image view). iOS remembers a bad launch screen until the app is
updated, so on a simulator that already showed black, erase it or use a fresh one.

## Point the shell at a dev server

The app loads the live site, so site changes only reach it once merged to `main` and deployed by
Netlify. To test them first, point the shell at a dev server. WKWebView needs a trusted HTTPS
origin for location and the mic, so serve it over Tailscale (use another port if a second worktree
already runs on 3000):

```bash
DEVTOOLS_EVENT_BUS_PORT=42070 bun --bun vite dev --port 3001 --strictPort   # in the background
tailscale serve --bg --https=3001 http://localhost:3001
CAP_SERVER_URL=https://alex-macbook-pro.tailf22ce6.ts.net:3001 bun run ios:sync
```

`server.url` is baked in at sync time, so rebuild and reinstall the app afterwards. Sign in again
(each origin has its own session); the Clerk dev instance accepts the Tailscale origin. The
offline page's "Try again" always links to production, so it leaves the app while testing.

When done: stop the dev server, `tailscale serve --https=3001 off`, then run `bun run ios:sync`
again without the variable, rebuild and reinstall to go back to production (always before
archiving).

To test the offline page, sync with `CAP_SERVER_URL=https://127.0.0.1:9`.

## First run (needs Xcode)

1. Install Xcode from the App Store, open it once and accept the license.
2. `bun install`, then `bun run ios:sync` (writes `ios/App/App/capacitor.config.json`, which is
   git-ignored, so always sync after cloning or changing the config).
3. `bun run ios:open` opens `ios/App/App.xcodeproj`. Xcode resolves the Swift packages.
4. Target **App** → _Signing & Capabilities_: pick your team (a free Apple ID works for the
   simulator and your own phone for 7 days).
5. Choose an iPhone simulator (e.g. iPhone 15 Pro Max) and press Run.
6. Check: the splash goes straight to the site (no white screen), sign-in, camera/photo pickers,
   microphone (voice commands), location on the map (one iOS prompt, no second WebKit one), the
   bottom nav clear of the home indicator, and that "Directions" opens Google Maps and the app is
   still there when you come back.

## Ad hoc distribution (dad's iPhone)

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Get the phone's UDID: connect it to the Mac, open Finder, select the phone and click the
   text under its name until the UDID shows; right-click to copy.
3. developer.apple.com → Certificates, IDs & Profiles:
   - **Devices**: register the UDID.
   - **Identifiers**: register the App ID `com.waumann.nachoos`.
   - **Profiles**: create an _Ad Hoc_ profile for that App ID including the device
     (or let Xcode's automatic signing create it).
4. In Xcode select _Any iOS Device (arm64)_, bump the build number, then Product → Archive.
5. Organizer → Distribute App → _Release Testing_ (Ad Hoc) → export the `.ipa`.
6. Install: connect the phone and drag the `.ipa` onto it in Finder (or use Apple
   Configurator → Add → Apps).

The ad hoc profile and distribution certificate expire after a year. Renew them, re-archive
and reinstall before then, or the app stops launching. Adding a new device also means
regenerating the profile and reinstalling.
