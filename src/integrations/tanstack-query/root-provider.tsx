import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexQueryClient } from "@convex-dev/react-query";

import { env } from "@/env";

// Create QueryClient singleton
export const queryClient = new QueryClient();

// Create ConvexQueryClient with queryClient passed in constructor
// This connects them immediately without needing a separate connect() call
export const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL, {
  queryClient,
});

// Set Convex-specific defaults:
// - hashFn: Custom hash for Convex queries, falls back to default for others
// - queryFn: Required for convexQuery() to work; non-Convex queries must provide their own
// Note: staleTime is not set globally - convexQuery() already includes staleTime: Infinity per-query
queryClient.setDefaultOptions({
  queries: {
    queryKeyHashFn: convexQueryClient.hashFn(),
    queryFn: convexQueryClient.queryFn(),
  },
});

export function Provider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
