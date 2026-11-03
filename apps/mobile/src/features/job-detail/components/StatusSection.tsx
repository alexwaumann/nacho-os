import type { SFSymbol } from "expo-symbols";
import { Alert, StyleSheet, View } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import { formatIsoDate } from "@shared/calendar";
import { getStatusActions, STATUS_LABELS } from "@shared/jobs/jobSheet";
import type { JobStatus } from "@shared/jobs/jobSheet";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { space } from "@/lib/theme";

import type { useJobMutations } from "../hooks/useJobMutations";
import { ActionButton, Pill, Section } from "./SheetParts";

/** The button for moving a job to each status, and what to ask first */
export const STATUS_ACTIONS: Record<
  JobStatus,
  { title: string; icon: SFSymbol; question: string; message?: string; done: string }
> = {
  completed: {
    title: "Mark job complete",
    icon: "checkmark.circle.fill",
    question: "Mark this job complete?",
    done: "Job marked complete",
  },
  paid: {
    title: "Mark as paid",
    icon: "dollarsign.circle.fill",
    question: "Mark this job as paid?",
    done: "Job marked paid",
  },
  pending: {
    title: "Mark as not done",
    icon: "arrow.uturn.backward.circle",
    question: "Mark this job as not done?",
    message: "It goes back to your jobs to do.",
    done: "Job moved back to not done",
  },
};

/** Ask, then change the job's status */
export function confirmStatusChange(
  status: JobStatus,
  setStatus: ReturnType<typeof useJobMutations>["setStatus"],
) {
  const action = STATUS_ACTIONS[status];
  Alert.alert(action.question, action.message, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Yes",
      isPreferred: true,
      onPress: () =>
        void setStatus(status).then((isSaved) => {
          if (isSaved) toast.success(action.done);
        }),
    },
  ]);
}

export const STATUS_TONES = {
  pending: "primary",
  completed: "warning",
  paid: "success",
} as const;

/** Where the job stands, with the dates it was finished and paid, and buttons to move it on */
export function StatusSection({
  job,
  mutations,
}: {
  job: Doc<"jobs">;
  mutations: ReturnType<typeof useJobMutations>;
}) {
  const dates = [
    job.completedOn && job.status !== "pending" ?
      `Finished ${formatIsoDate(job.completedOn)}`
    : null,
    job.paidOn && job.status === "paid" ? `Paid ${formatIsoDate(job.paidOn)}` : null,
  ].filter(Boolean);

  return (
    <Section title="Status">
      <View style={styles.row}>
        <Pill label={STATUS_LABELS[job.status]} tone={STATUS_TONES[job.status]} />
      </View>
      {dates.length > 0 ?
        <Text tone="muted">{dates.join(" · ")}</Text>
      : null}
      {getStatusActions(job.status).map((status, i) => (
        <ActionButton
          key={status}
          title={STATUS_ACTIONS[status].title}
          icon={STATUS_ACTIONS[status].icon}
          variant={i === 0 ? "primary" : "outline"}
          onPress={() => confirmStatusChange(status, mutations.setStatus)}
        />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
