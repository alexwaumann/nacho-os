import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

import { speak } from "../lib/speech";

/**
 * Reads a voice reply out loud unless "Read replies out loud" is turned off in Account (on by
 * default, the same setting as the web app's).
 */
export function useSpokenReplies() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const isEnabled = user?.settings?.readRepliesAloud !== false;

  return (text: string) => {
    if (isEnabled) void speak(text);
  };
}
