import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ConvexQueryClient } from "@convex-dev/react-query";

import { env } from "@/env";

// 7 days in milliseconds
const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: SEVEN_DAYS,
      staleTime: Infinity,
    },
  },
});

export const convexQueryClient = new ConvexQueryClient(env.VITE_CONVEX_URL, {
  queryClient,
});

// - hashFn: Custom hash for Convex queries, falls back to default for others
// - queryFn: Required for convexQuery() to work; non-Convex queries must provide their own
queryClient.setDefaultOptions({
  queries: {
    queryKeyHashFn: convexQueryClient.hashFn(),
    queryFn: convexQueryClient.queryFn(),
    gcTime: SEVEN_DAYS,
    staleTime: Infinity,
  },
});

const persister =
  typeof window !== "undefined" ?
    createSyncStoragePersister({
      storage: window.localStorage,
      key: "nacho-query-cache",
    })
  : undefined;

export function Provider({ children }: { children: React.ReactNode }) {
  // SSR fallback - no persistence available
  if (!persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: SEVEN_DAYS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
