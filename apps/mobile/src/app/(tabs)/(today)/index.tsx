import { useConvexAuth, useQuery } from "convex/react";
import { ActivityIndicator } from "react-native";

import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { RouteStopCard } from "@/features/today/components/RouteStopCard";

/** Today: the stops on today's route, in route order (read-only for now). */
export default function TodayScreen() {
  const { isAuthenticated } = useConvexAuth();
  // Same query as the web Today page; "skip" until Convex has the sign-in token
  const stops = useQuery(api.jobs.getSelectedForRoute, isAuthenticated ? {} : "skip");

  return (
    <Screen>
      {stops === undefined ?
        <ActivityIndicator size="large" accessibilityLabel="Loading today's route" />
      : stops.length === 0 ?
        <Card>
          <Text variant="heading">No stops today</Text>
          <Text tone="muted">Jobs you add to today&apos;s route show up here.</Text>
        </Card>
      : stops.map((job, index) => <RouteStopCard key={job._id} job={job} stopNumber={index + 1} />)}
    </Screen>
  );
}
