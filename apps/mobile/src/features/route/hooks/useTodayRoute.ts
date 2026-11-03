import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { getHomeLegSeconds } from "@shared/jobs/today";

/**
 * Today's route from Convex: the stops in route order, the route totals and his home. Every
 * value is undefined while loading (Convex hooks are live, so they update by themselves).
 */
export function useTodayRoute() {
  const { isAuthenticated } = useConvexAuth();
  const args = isAuthenticated ? {} : "skip";

  const stops = useQuery(api.jobs.getSelectedForRoute, args);
  const totals = useQuery(api.jobs.getRouteTotals, args);
  const currentUser = useQuery(api.users.getCurrentUser, args);

  const homeCoordinates = currentUser?.homeCoordinates;
  // The drive from the last stop back home, only when a home address is set
  const homeLegSeconds = homeCoordinates && stops ? getHomeLegSeconds(totals, stops) : undefined;

  return {
    stops,
    totals,
    currentUser,
    homeCoordinates,
    homeLegSeconds,
    isLoaded: stops !== undefined,
  };
}
