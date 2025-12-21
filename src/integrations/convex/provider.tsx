import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { useAuth } from "@clerk/clerk-react";

import { env } from "@/env";

const CONVEX_URL = env.VITE_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("missing envar CONVEX_URL");
}
const convexQueryClient = new ConvexQueryClient(CONVEX_URL);

export default function AppConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convexQueryClient.convexClient} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
