import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

import { env } from "@/lib/env";

const convex = new ConvexReactClient(env.convexUrl, {
  // Required in React Native, where there's no page unload to flush pending writes
  unsavedChangesWarning: false,
});

/**
 * Clerk (sign-in, with the session token kept in the iOS Keychain via expo-secure-store) and
 * Convex, authenticated with Clerk's "convex" JWT template like the web app.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
