import { useConvexAuth, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import type { JobFilter } from "@shared/jobs/jobsList";
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
 * The Jobs tab: Pending / Completed / Paid with counts, then the jobs as a list (searchable by
 * address) or on a map. The filter and view are route params (`/jobs?filter=paid&view=map`), like
 * the web page's URL, so links can open the map directly.
 */
export function JobsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string; view?: string }>();
  const filter = parseFilter(params.filter);
  const view: JobsView = params.view === "map" ? "map" : "list";
  const [searchQuery, setSearchQuery] = useState("");
  const headerHeight = useHeaderHeight();

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
      // The header is transparent, so make room for it; the native bottom safe area here
      // includes the tab bar, so the map ends just above it
      <SafeAreaView
        edges={["bottom", "left", "right"]}
        style={[
          styles.mapScreen,
          { paddingTop: headerHeight + space.sm, backgroundColor: colors.background },
        ]}
      >
        {controls}
        <JobsMap filter={filter} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.SearchBar
        placeholder="Search by address"
        hideWhenScrolling={false}
        autoCapitalize="none"
        onChangeText={(event) => setSearchQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setSearchQuery("")}
      />
      <JobsList jobs={jobs} filter={filter} searchQuery={searchQuery} header={controls} />
    </>
  );
}

const styles = StyleSheet.create({
  controls: { gap: space.md, marginBottom: space.lg },
  mapScreen: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.lg },
});
