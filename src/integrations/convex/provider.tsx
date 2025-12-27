import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/clerk-react";

import { convexQueryClient } from "@/integrations/tanstack-query/root-provider";

export default function AppConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convexQueryClient.convexClient} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
