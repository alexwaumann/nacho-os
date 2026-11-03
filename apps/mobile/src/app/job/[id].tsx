import { useLocalSearchParams } from "expo-router";

import type { Id } from "@convex/_generated/dataModel";
import { JobDetailSheet } from "@/features/job-detail/components/JobDetailSheet";

/**
 * Job detail, presented as a native sheet (see the root layout: formSheet with detents).
 * Open it with `router.push({ pathname: "/job/[id]", params: { id } })`; add `tab` ("tasks",
 * "info", "money", "photos") to open a specific tab instead of the job's default one.
 */
export default function JobSheet() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  return <JobDetailSheet key={id} jobId={id as Id<"jobs">} initialTab={tab} />;
}
