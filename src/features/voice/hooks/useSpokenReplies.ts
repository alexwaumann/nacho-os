import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import { speak } from "../lib/speech";

/** Reads a voice reply out loud unless "Read replies out loud" is turned off in Account. */
export function useSpokenReplies() {
  const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}));
  const isEnabled = user?.settings?.readRepliesAloud !== false;

  return (text: string) => {
    if (isEnabled) speak(text);
  };
}
