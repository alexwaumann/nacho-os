# Nacho OS – iOS app (Expo)

The native iOS rewrite of the web app in the repo root. iOS only, built with
[Expo](https://docs.expo.dev) (SDK 58) and Expo Router, using the same Convex backend and Clerk
sign-in as the website. It installs next to the old Capacitor app: bundle id
`com.waumann.nachoos.native`, display name "Nacho OS".

It is a **standalone project**: its own `package.json`, `bun.lock` and `node_modules`, not a Bun
workspace with the web app, so its React / React Native versions never clash with the web app's.
Run every command in this README from `apps/mobile`.

## Setup

Needs Xcode (with an iOS Simulator runtime), CocoaPods (`brew install cocoapods`) and Bun.

```bash
bun install                  # in the repo root first: typecheck follows the API types into convex/
cd apps/mobile
bun install
cp .env.example .env.local   # then fill it in (below)
```

The root install is only for `bun run typecheck`: the Convex API types point at the functions in
`convex/`, which import the web app's packages (`@google/genai`, `zod`, …). The app bundle itself
uses only `apps/mobile/node_modules`.

`.env.local` (git-ignored) holds the same values as the web app's `VITE_*` ones in the repo root
`.env.local`:

| Variable                            | Same as                      |
| ----------------------------------- | ---------------------------- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `VITE_CLERK_PUBLISHABLE_KEY` |
| `EXPO_PUBLIC_CONVEX_URL`            | `VITE_CONVEX_URL`            |

```bash
grep -E '^VITE_(CLERK_PUBLISHABLE_KEY|CONVEX_URL)=' ../../.env.local | sed 's/^VITE_/EXPO_PUBLIC_/' > .env.local
```

`EXPO_PUBLIC_*` values are compiled into the JS bundle; restart Metro after changing them. The app
talks to the shared Convex **dev** deployment (the one the live website uses) and the Clerk dev
instance. Sign in with a username and password. If Clerk asks for more (a code by email or text
for a new device, a second factor, a new password), `src/app/sign-in.tsx` shows that step; which
step comes next is decided by `getSignInStep` in `shared/auth/signInSteps.ts`.

## Run in the Simulator

```bash
bunx expo run:ios                 # prebuild if needed, build, install, start Metro, launch
bunx expo run:ios --device "<simulator name>"   # pick a simulator
```

The app is a **development build** (`expo-dev-client`), not Expo Go: native code is compiled into
the app and the JS comes from Metro. After the first build you only need Metro:

```bash
bun run start                     # = expo start --dev-client (port 8081; add --port 8082 if busy)
```

Rebuild (`bunx expo run:ios`) only when native code changes: a new package with native code, an
`app.json` change (plugins, permissions, icon, splash), or an Expo SDK upgrade. JS/TS changes
reload over Metro.

### Native project (Continuous Native Generation)

`ios/` is **generated** by `expo prebuild` from `app.json` and the config plugins, and is
git-ignored. Never edit it by hand: change `app.json` (or add a config plugin) and regenerate:

```bash
bun run prebuild                  # = expo prebuild --platform ios --clean
```

Building by hand (what the skeleton PR did, to keep build output inside the worktree):

```bash
cd ios && xcodebuild -workspace NachoOS.xcworkspace -scheme NachoOS -configuration Debug \
  -sdk iphonesimulator -destination "id=<simulator udid>" -derivedDataPath build/DerivedData build
xcrun simctl install <simulator udid> build/DerivedData/Build/Products/Debug-iphonesimulator/NachoOS.app
```

Free disk afterwards with `rm -rf ios/build` (and `~/Library/Developer/Xcode/DerivedData/NachoOS-*`
if you built from Xcode or `expo run:ios`).

## Install on a real iPhone (free Apple ID)

No paid Apple Developer account is needed to put the app on your own phone, with limits: the app
stops opening after **7 days** and must be reinstalled, and push notifications, App Groups and
widgets are unavailable.

1. Xcode → Settings → Accounts: add your Apple ID. That creates a "Personal Team".
2. `bun run prebuild`, then `xed ios` to open the workspace.
3. Target **NachoOS** → _Signing & Capabilities_: tick _Automatically manage signing_ and pick the
   Personal Team. If Xcode says the bundle id is taken, change it locally (don't commit that).
4. Connect the iPhone by cable and trust the Mac. On the phone, turn on
   _Settings → Privacy & Security → Developer Mode_ (it restarts).
5. Pick the phone as the run destination. For a build that runs **without Metro**, choose
   _Product → Scheme → Edit Scheme → Run → Build Configuration → Release_; Debug builds need Metro
   running on the same network.
6. Run. The first time, the phone refuses to open it: _Settings → General → VPN & Device
   Management_ → your Apple ID → _Trust_.
7. Every 7 days: connect the phone and press Run again (data in the app is kept).

`bunx expo run:ios --device` also works once signing is set up in Xcode.

Over-the-air JS updates (EAS Update) are planned but not set up yet; nothing in this project should
block them (no hand-edited `ios/`, everything in `app.json`).

## Structure and conventions

```
apps/mobile/
  app.json              # Expo config: name, bundle id, icon, splash, plugins
  metro.config.js       # lets the app import ../../convex and ../../shared (see below)
  assets/               # app-only images (splash logo, sign-in logo)
  src/
    app/                # Expo Router routes (file = screen). Keep route files thin.
      _layout.tsx       # providers, splash, signed-in / signed-out guard, root Stack
      sign-in.tsx
      (tabs)/
        _layout.tsx     # native tab bar (Today, Jobs, Account); voice mic slot
        (today)/        # each tab is a folder with its own Stack (large title header)
          _layout.tsx
          index.tsx     # "/"
        jobs/           # "/jobs"
        account/        # "/account"
      job/[id].tsx      # job detail, a native formSheet over the tabs ("/job/<id>")
    components/
      ui/               # primitives: text, button, card, screen, text-field (kebab-case files)
      *.tsx             # shared app components (PascalCase), e.g. TabStack
    features/<feature>/ # per-feature code: components/, hooks/, lib/ (e.g. features/today/)
    hooks/              # app-wide hooks (useTheme, useSyncUser)
    integrations/       # providers (Clerk + Convex)
    lib/                # theme tokens, env, small app-only utilities
```

- **Routes** live in `src/app` and should mostly compose feature components. Put a feature's
  components, hooks and helpers under `src/features/<feature>/` (`today`, `jobs`, `job-sheet`,
  `add-job`, `scan`, `voice`, `account` …), not in `src/app`.
- **New tab screens** that push (e.g. a job list filter) go in the tab's folder; add a
  `<Stack.Screen>` to that tab's `_layout.tsx` if it needs options. **Screens shown over the
  tabs** (sheets, modals) go at the root of `src/app` and get a `<Stack.Screen>` inside the
  signed-in `Stack.Protected` in `src/app/_layout.tsx`.
- **Open a job** with `router.push({ pathname: "/job/[id]", params: { id } })` or
  `<Link href={{ pathname: "/job/[id]", params: { id } }} asChild>`.
- **Voice** (`src/features/voice/`): the global mic is `<NativeTabs.BottomAccessory>` in
  `src/app/(tabs)/_layout.tsx` (its state lives in the layout: iOS draws the accessory twice), the
  job mic sits in the job sheet's header. See "Testing voice in the Simulator" below.
- **Naming** follows the root AGENTS.md: components PascalCase, hooks `useX`, UI primitives
  kebab-case, `handle*` event handlers, `is*`/`has*` booleans, `@/` imports after relative Convex
  ones.

### Styling and accessibility

The user is in his 60s on an iPhone 15 Pro Max (430×932 pt). Use the primitives in
`src/components/ui` so text and tap targets stay big:

- `Text` (`variant`: `title` 30, `heading` 24, `body` 20, `label` 20, `caption` 17; `tone`:
  `default`, `muted`, `primary`, `destructive`, `onPrimary`). It scales with Dynamic Type, capped
  per variant (`maxScale` in `src/lib/theme.ts`) so the largest accessibility sizes still fit.
  Don't use React Native's `Text` directly.
- `Button` is at least 56 pt tall (`minTapSize`); keep every tappable thing at least that.
- `Screen` is the scrolling page body; put it first in a tab screen so the large title collapses.
- Colors come from `useTheme()` (follows the system light/dark setting); the palette in
  `src/lib/theme.ts` is the web brand (`src/styles.css`) in hex. Use `StyleSheet.create` + theme
  values; no styling library.
- Prefer native: SF Symbols (`expo-symbols`), native headers, sheets and tab bar, `Alert` for
  confirmations.

## Data: Convex and Clerk

- **Convex API**: import from the repo's generated code through the `@convex/*` alias:
  `import { api } from "@convex/_generated/api"`, `import type { Doc, Id } from
"@convex/_generated/dataModel"`. Pure helpers in `convex/lib/` can be imported the same way.
- **Fetching**: use the `convex/react` hooks directly – `useQuery`, `useMutation`, `useAction`,
  `usePaginatedQuery`. No TanStack Query: the web app uses it for its persisted cache, but Convex's
  hooks are already live and cached per client, which is all the app needs so far. Pass `"skip"`
  until Convex has the sign-in, so screens don't flash "nothing here":

  ```tsx
  const { isAuthenticated } = useConvexAuth();
  const stops = useQuery(api.jobs.getSelectedForRoute, isAuthenticated ? {} : "skip");
  // undefined = loading
  ```

- **Errors**: show `getErrorMessage(error)` from `@shared/errors` (same helper as the web): it
  passes `ConvexError` messages through and hides raw server errors. `instanceof ConvexError`
  works because there is only one copy of `convex` in the bundle (see Metro below).
- **Auth**: `@clerk/expo` with the session token in the iOS Keychain (`expo-secure-store` via
  `@clerk/expo/token-cache`), so he stays signed in across launches. `useAuth`, `useUser`,
  `useClerk().signOut()` come from `@clerk/expo`. `ConvexProviderWithClerk` gets Convex tokens from
  Clerk's `convex` JWT template, like the web. `useSyncUser` (in the tabs layout) creates his
  `users` row on sign-in, like the web Today page.
- **Never** run `convex dev` / `convex deploy` from here: the deployment is shared with the live
  website. Backend changes go through the normal Convex workflow in the repo root.

## Shared code

`../../shared/` holds framework-free TypeScript used by both apps (dates, addresses, error
messages, route/today/due-date math, receipt job ranking). Import it with `@shared/*`, e.g.
`import { isStopDone } from "@shared/jobs/today"`. Rules:

- No React, DOM, React Native or Node APIs; only `convex/values` and types from
  `convex/_generated` (relative imports inside `shared/`).
- Tests sit next to the code (`*.test.ts`) and run from the repo root: `bun run test`.
- The web app imports the same files through the same alias.

## App helpers (use these, don't re-create them)

- **Toasts:** `toast.success/error/info(title, { description, action: { label: "Undo", onPress }, duration, id })`
  and `toastError(title, error)` from `@/components/ui/toast`. `toastError` shows a plain message via
  `getErrorMessage`. `<Toaster />` is mounted once in `src/app/_layout.tsx` and draws above sheets.
  Call `await clearToastsBeforePresenting()` before opening a photo picker, camera or scanner:
  iOS ignores those while a toast's overlay window is up.
- **Location:** `getCurrentLocation()` from `@/lib/location` asks for permission and returns
  `{ lat, lng }`, or throws a `LocationError` with a plain message (`describeLocationError`).
  `isLocationSettingsError` tells you when to offer `Linking.openSettings()`.
- **Directions:** `openDirectionsTo(address)` and `openRouteDirections(stops, homeCoordinates)`
  from `@/lib/directions` open Google Maps links (in the Google Maps app when it's installed),
  built by `@shared/googleMaps`, the same as the web app.

## Native modules

Every native module the app needs is already installed and in the dev client build, so feature
work is JavaScript-only. A rebuild is only needed after adding a native module or changing `app.json`:

| Need                                 | Package                                               |
| ------------------------------------ | ----------------------------------------------------- |
| Apple Maps (in-app map)              | `react-native-maps` (default provider; no Google SDK) |
| Current location                     | `expo-location`                                       |
| Camera / photo library               | `expo-image-picker`                                   |
| PDFs and other files                 | `expo-document-picker`, `expo-file-system`            |
| Scanning receipts, checks, paperwork | `react-native-document-scanner-plugin` (VisionKit)    |
| Showing images / PDFs                | `expo-image`, `react-native-webview`                  |
| Voice recording / reading replies    | `expo-audio`, `expo-speech`                           |
| Haptics, share sheet, clipboard      | `expo-haptics`, `expo-sharing`, `expo-clipboard`      |
| Liquid Glass surfaces                | `expo-glass-effect`                                   |

Versions are pinned to the newest releases that both pass Bun's 7-day minimum release age and
are no newer than the installed `expo-modules-core`. Newer precompiled modules can crash at launch
(see Gotchas). `app.json` holds the permission prompts and lists `comgooglemaps` in
`LSApplicationQueriesSchemes`, so "Directions" can check whether the Google Maps app is installed.
To open a place there, use `comgooglemaps://?daddr=<address>&directionsmode=driving`; if it isn't
installed, fall back to `https://www.google.com/maps/dir/?api=1&destination=<address>`.

**Prebuilt dev client for parallel work:** a simulator build of the current native setup is kept
at `~/.t3/nacho-devclient/NachoOS.app` (outside the repo). With JS-only changes, install that
(`xcrun simctl install <udid> ~/.t3/nacho-devclient/NachoOS.app`) and run Metro from your worktree
(`bun run start -- --port <port>`), so you don't need your own Xcode build.

## Testing voice in the Simulator

The Simulator's microphone is the Mac's, which hears nothing useful (and macOS may first ask
whether "SimulatorTrampoline" may use the microphone; until that's answered, starting the mic
times out with "The microphone didn't start"). In development builds a prepared clip can stand in
for the microphone:

```bash
mkdir -p /tmp/voice-clips && cd /tmp/voice-clips      # outside the repo; don't commit clips
say -o route.m4a --data-format=aac "What's on my route today?"
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `nachoos://?voiceClip=http%3A%2F%2Flocalhost%3A8765%2Froute.m4a` on the Simulator (e.g.
`agent-device open com.waumann.nachoos.native "<link>"`). It opens Today and arms the clip; the
next tap on either mic runs the normal Listening → Send flow without touching the microphone and
sends the clip. Add `&voiceMime=text%2Fplain` to make the server reject it (error + Try again).
The link is ignored in release builds (`__DEV__`). Undo every change a test makes: the data is
shared with the live website.

## Metro (why `metro.config.js` exists)

The app imports `../../convex` and `../../shared`, which are outside the project, so they're in
`watchFolders`. Those files import `convex/server` / `convex/values`, which would otherwise
resolve to the web app's `node_modules` (a different `convex` version). The config makes every
bare import from outside `apps/mobile` resolve from `apps/mobile/node_modules`, so there is exactly
one copy of `convex`, `react` and `react-native`. TypeScript does the same with `paths` in
`tsconfig.json`. Don't add the repo root to `watchFolders`.

Assets must live inside `apps/mobile` (or a watched folder) to be `require`d; `app.json` may point
at `../../resources` because that's read at prebuild time, not by Metro.

## Scripts

```bash
bun run start       # Metro for the dev client
bun run ios         # expo run:ios
bun run prebuild    # regenerate ios/
bun run typecheck   # tsc --noEmit (includes the Convex functions the API types point at)
bun run lint        # expo lint (eslint-config-expo)
bun run format      # prettier with the repo root config
```

## Gotchas

- `bun add` refuses versions published in the last 7 days; `expo install --check` may ask for a
  patch that is too new. Use the newest allowed one and note it in the PR.
- **Expo packages must come from the same release.** Some Expo modules ship precompiled
  (`ExpoModulesCore`, `ExpoFileSystem`, `ExpoFont` …). If the age limit lets a newer module in
  but holds back the `expo-modules-core` it was built against, the app builds fine and then
  **crashes at launch** with `dyld: Symbol not found: …ExpoModulesCore…` (check with
  `xcrun simctl spawn <udid> log show --last 2m --predicate 'eventMessage CONTAINS "Symbol not found"'`).
  That's why `package.json` has `"overrides": { "expo-file-system": "58.0.11" }` (the version
  released with expo 58.0.19). Drop the override when upgrading `expo` itself, and after any
  Expo upgrade rebuild and launch once before pushing.
- `react-dom` is a dependency only because `@clerk/expo` imports it; it must be the **exact**
  same version as `react`, or the app shows a red "Incompatible React versions" screen.
- New native packages (camera, location, maps, audio …) need a rebuild, and their permission
  strings belong in `app.json` (plugin options or `ios.infoPlist`). Parallel PRs that add
  packages will conflict in `package.json` / `bun.lock`: resolve by taking main's files and
  re-running `bun add` for your packages.
- Typed routes (`experiments.typedRoutes`) are generated into `.expo/types` by `expo start`;
  before the first start, `href`s are untyped.
- ESLint is pinned to 9: `eslint-plugin-react` (used by `eslint-config-expo`) crashes on ESLint 10.
