# iOS app (Capacitor shell)

The iOS app is a thin [Capacitor 8](https://capacitorjs.com) wrapper: a native WKWebView that
loads the live site at <https://nacho-os.netlify.app>. Nothing from `dist/` is bundled, because
the server functions in `src/server/` (Gemini, voice, weather, geo, route brief) need the
TanStack Start server. A web deploy updates the app instantly; a new native build is only needed
when `capacitor.config.ts`, `ios/` or the Capacitor packages change.

- `capacitor.config.ts` – app id `com.waumann.nachoos`, `server.url`, allowed navigation hosts.
- `native/www/` – offline page, shown via `server.errorPath` when the site can't load (no
  signal). Its "Try again" button goes back to the site.
- `ios/` – Xcode project; plugins come in via Swift Package Manager (no CocoaPods).
- `ios/App/App/Info.plist` – display name and camera / microphone / location / photo prompts.

Links to other hosts (e.g. Google Maps directions) are handed to iOS by Capacitor and open in
Google Maps or Safari, so the app stays on its page. Clerk hosts are allowed to load in the app.

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
