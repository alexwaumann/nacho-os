import { useConvexAuth, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import type { JobFilter } from "@shared/jobs/jobsList";
import { StatusBarScrim } from "@/components/StatusBarScrim";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SegmentOption } from "@/components/ui/segmented-control";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/lib/theme";

import { JobsList } from "./JobsList";
import { JobsMap } from "./JobsMap";

type JobsView = "list" | "map";

const filters: readonly { value: JobFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "paid", label: "Paid" },
];

const viewOptions: readonly SegmentOption<JobsView>[] = [
  { value: "list", label: "List", icon: "list.bullet" },
  { value: "map", label: "Map", icon: "map" },
];

function parseFilter(value: string | undefined): JobFilter {
  return value === "completed" || value === "paid" ? value : "pending";
}

/**
 * The Jobs tab: a search by address (list only), Pending / Completed / Paid with counts, then the
 * jobs as a list or on a map. No header: the search box is the first thing under the status bar. The filter and view are route params (`/jobs?filter=paid&view=map`), like
 * the web page's URL, so links can open the map directly.
 */
export function JobsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string; view?: string }>();
  const filter = parseFilter(params.filter);
  const view: JobsView = params.view === "map" ? "map" : "list";
  const [searchQuery, setSearchQuery] = useState("");

  const { isAuthenticated } = useConvexAuth();
  const stats = useQuery(api.jobs.getStats, isAuthenticated ? {} : "skip");
  const jobs = useQuery(
    api.jobs.list,
    isAuthenticated && view === "list" ? { status: filter } : "skip",
  );

  const filterOptions: SegmentOption<JobFilter>[] = filters.map((option) => {
    const count = stats?.[option.value];
    return {
      ...option,
      detail: count === undefined ? " " : String(count),
      accessibilityLabel:
        count === undefined ?
          option.label
        : `${option.label}, ${count} ${count === 1 ? "job" : "jobs"}`,
    };
  });

  const handleFilterChange = (next: JobFilter) => {
    router.setParams({ filter: next === "pending" ? undefined : next });
  };

  const handleViewChange = (next: JobsView) => {
    // The search is only on the list; start fresh when coming back to it
    setSearchQuery("");
    router.setParams({ view: next === "list" ? undefined : next });
  };

  const controls = (
    <View style={styles.controls}>
      {view === "list" ?
        <SearchField
          placeholder="Search by address"
          accessibilityLabel="Search jobs by address"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      : null}
      <SegmentedControl
        options={filterOptions}
        value={filter}
        onChange={handleFilterChange}
        accessibilityLabel="Which jobs to show"
      />
      <SegmentedControl
        options={viewOptions}
        value={view}
        onChange={handleViewChange}
        accessibilityLabel="Show jobs as"
      />
    </View>
  );

  if (view === "map") {
    return (
      // The native bottom safe area here includes the tab bar, so the map ends just above it
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={[styles.mapScreen, { backgroundColor: colors.background }]}
      >
        {controls}
        <JobsMap filter={filter} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <JobsList jobs={jobs} filter={filter} searchQuery={searchQuery} header={controls} />
      <StatusBarScrim />
    </>
  );
}

const styles = StyleSheet.create({
  controls: { gap: space.md, marginBottom: space.lg },
  mapScreen: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
});
