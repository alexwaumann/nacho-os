# iOS app (Capacitor shell)

The iOS app is a thin [Capacitor 8](https://capacitorjs.com) wrapper: a native WKWebView that
loads the live site at <https://nacho-os.netlify.app>. Nothing from `dist/` is bundled, because
the server functions in `src/server/` (Gemini, voice, weather, geo, route brief) need the
TanStack Start server. A web deploy updates the app instantly; a new native build is only needed
when `capacitor.config.ts`, `ios/` or the Capacitor packages change.

- `capacitor.config.ts` – app id `com.waumann.nachoos`, `server.url`, allowed navigation hosts.
- `native/www/` – placeholder page (Capacitor requires a `webDir`).
- `ios/` – Xcode project; plugins come in via Swift Package Manager (no CocoaPods).
- `ios/App/App/Info.plist` – display name and camera / microphone / location / photo prompts.

Links to other hosts (e.g. Google Maps directions) are handed to iOS by Capacitor and open in
Google Maps or Safari, so the app stays on its page. Clerk hosts are allowed to load in the app.

## Point the shell at a dev server

`server.url` is read when you sync, so set `CAP_SERVER_URL` on the sync command:

```bash
tailscale serve --https=3000 http://localhost:3000   # if not already serving
CAP_SERVER_URL=https://alex-macbook-pro.tailf22ce6.ts.net:3000 bun run ios:sync
```

Run `bun run ios:sync` again without the variable to go back to production before archiving.

## First run (needs Xcode)

1. Install Xcode from the App Store, open it once and accept the license.
2. `bun install`, then `bun run ios:sync` (writes `ios/App/App/capacitor.config.json`, which is
   git-ignored, so always sync after cloning or changing the config).
3. `bun run ios:open` opens `ios/App/App.xcodeproj`. Xcode resolves the Swift packages.
4. Target **App** → _Signing & Capabilities_: pick your team (a free Apple ID works for the
   simulator and your own phone for 7 days).
5. Choose an iPhone simulator (e.g. iPhone 15 Pro Max) and press Run.
6. Check: sign-in, camera/photo pickers, microphone (voice commands), location on the map,
   and that "Directions" opens Google Maps and the app is still there when you come back.

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
