// Build-time settings from apps/mobile/.env.local (see .env.example). Expo inlines
// `process.env.EXPO_PUBLIC_*` into the bundle, so read each one by its full name.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy apps/mobile/.env.example to .env.local.`);
  }
  return value;
}

export const env = {
  clerkPublishableKey: required(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ),
  convexUrl: required("EXPO_PUBLIC_CONVEX_URL", process.env.EXPO_PUBLIC_CONVEX_URL),
};
