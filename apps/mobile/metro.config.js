// Metro config for the Expo app, which lives inside the web app's repo (apps/mobile).
//
// The app imports code from outside its own folder:
//   - ../../convex     (the Convex API: `@convex/_generated/api`, and pure helpers in convex/lib)
//   - ../../shared     (framework-free helpers shared with the web app: `@shared/...`)
// Metro only bundles files inside the project root or `watchFolders`, so both are watched.
//
// Those files import npm packages too (`convex/server`, `convex/values`), and walking up from
// ../../convex leads to the *web app's* node_modules, with its own (older) `convex`. A second copy
// would mean e.g. a second `ConvexError` class, so `instanceof` checks fail. Two things prevent it:
//   - only convex/ and shared/ are watched, never the repo root, so Metro can't see the web app's
//     node_modules, and `nodeModulesPaths` points at this app's;
//   - `resolveRequest` resolves every bare import from outside apps/mobile as if it came from
//     apps/mobile, so this holds even if someone adds the repo root to `watchFolders` later.
// Result: exactly one copy of convex, react and react-native, the app's own.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.join(repoRoot, "convex"), path.join(repoRoot, "shared")];
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];

const isBareImport = (name) => !name.startsWith(".") && !path.isAbsolute(name);
const isOutsideApp = (file) => !file.startsWith(projectRoot + path.sep);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (isBareImport(moduleName) && isOutsideApp(context.originModulePath)) {
    const fromApp = { ...context, originModulePath: path.join(projectRoot, "index.js") };
    return resolve(fromApp, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
