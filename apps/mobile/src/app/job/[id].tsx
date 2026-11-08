import { useLocalSearchParams, useNavigation } from "expo-router";
import type { NavigationProp } from "expo-router/react-navigation";
import { useEffect } from "react";

import type { Id } from "@convex/_generated/dataModel";
import { JobDetailSheet } from "@/features/job-detail/components/JobDetailSheet";

type JobSheetParams = { id: string; tab?: string };

/**
 * Job detail, presented as a native sheet (see the root layout: formSheet with detents).
 * Open it with `router.push({ pathname: "/job/[id]", params: { id } })`; add `tab` ("tasks",
 * "info", "money", "photos") to open a specific tab instead of the job's default one.
 *
 * There is only ever one job sheet (`singleJobSheetRouter` in the root layout): opening another
 * job while it's up swaps the job shown here, and opening the same job again only switches to
 * `tab`, if one is given.
 */
export default function JobSheet() {
  const { id, tab } = useLocalSearchParams<JobSheetParams>();
  const navigation = useNavigation<NavigationProp<{ "job/[id]": JobSheetParams }>>();

  // `tab` is a one-time request: clear it once the sheet has it, so asking for the same tab
  // again (after he switched to another one) still switches back
  useEffect(() => {
    if (tab) navigation.setParams({ tab: undefined });
  }, [tab, navigation]);

  return <JobDetailSheet key={id} jobId={id as Id<"jobs">} requestedTab={tab} />;
}
