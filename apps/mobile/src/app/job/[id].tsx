import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Text } from "@/components/ui/text";
import { space } from "@/lib/theme";

/**
 * Job detail, presented as a native sheet (see the root layout: formSheet with detents).
 * Placeholder until the Job detail sheet PR. Open it with `router.push("/job/<id>")` or
 * `<Link href={{ pathname: "/job/[id]", params: { id } }}>`.
 */
export default function JobSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useQuery(api.jobs.get, { jobId: id as Id<"jobs"> });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {job === undefined ?
        <ActivityIndicator size="large" />
      : job === null ?
        <Text variant="heading">Job not found</Text>
      : <>
          <Text variant="title">{job.address}</Text>
          {job.summary ?
            <Text>{job.summary}</Text>
          : null}
          <Text tone="muted">Job details are coming soon.</Text>
        </>
      }
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.xxl, gap: space.md },
});
