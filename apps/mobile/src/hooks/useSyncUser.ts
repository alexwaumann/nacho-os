import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";

import { api } from "@convex/_generated/api";

/**
 * Creates (or updates) his row in the Convex `users` table once Convex has his sign-in, like the
 * web app's Today page does. Queries return nothing for a user without a row.
 */
export function useSyncUser() {
  const { isAuthenticated } = useConvexAuth();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!isAuthenticated) return;
    getOrCreateUser().catch((error: unknown) => console.error("User sync failed:", error));
  }, [isAuthenticated, getOrCreateUser]);
}
