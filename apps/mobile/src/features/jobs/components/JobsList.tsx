import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import type { ReactElement } from "react";

import type { Doc } from "@convex/_generated/dataModel";
import { getVisibleJobs } from "@shared/jobs/jobsList";
import type { JobFilter } from "@shared/jobs/jobsList";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

import { useToggleRoute } from "../hooks/useToggleRoute";
import { JobCard } from "./JobCard";

interface JobsListProps {
  /** undefined while loading */
  jobs: Doc<"jobs">[] | undefined;
  filter: JobFilter;
  searchQuery: string;
  /** The filter and view controls, scrolled with the list */
  header: ReactElement;
}

const emptyText: Record<JobFilter, string> = {
  pending: "New jobs you add show up here.",
  completed: "Jobs you finish show up here.",
  paid: "Jobs show up here once they're paid.",
};

/**
 * The job cards for the filter, searched by address. It's the screen's scroll view, so the large
 * title collapses as it scrolls. Convex keeps the list live, so there's no pull to refresh.
 */
export function JobsList({ jobs, filter, searchQuery, header }: JobsListProps) {
  const { colors } = useTheme();
  const handleToggleRoute = useToggleRoute();
  const visibleJobs = jobs ? getVisibleJobs(jobs, filter, searchQuery) : undefined;
  const trimmedQuery = searchQuery.trim();

  return (
    <FlatList
      data={visibleJobs ?? []}
      keyExtractor={(job) => job._id}
      renderItem={({ item }) => <JobCard job={item} onToggleRoute={handleToggleRoute} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        visibleJobs === undefined ?
          <ActivityIndicator
            size="large"
            accessibilityLabel="Loading jobs"
            style={styles.loading}
          />
        : <Card>
            {trimmedQuery ?
              <>
                <Text variant="heading">No matches</Text>
                <Text tone="muted">
                  No {filter} jobs have “{trimmedQuery}” in the address.
                </Text>
              </>
            : <>
                <Text variant="heading">No {filter} jobs</Text>
                <Text tone="muted">{emptyText[filter]}</Text>
              </>
            }
          </Card>
      }
      ItemSeparatorComponent={Separator}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  separator: { height: space.lg },
  loading: { marginTop: space.xxl },
});
