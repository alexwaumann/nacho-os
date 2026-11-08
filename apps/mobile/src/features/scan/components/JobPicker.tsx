import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import type { Doc, Id } from "@convex/_generated/dataModel";
import { formatDueDate } from "@shared/jobs/jobsList";
import { SectionLabel } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

type Job = Doc<"jobs">;

const STATUS_LABELS: Record<Job["status"], string> = {
  pending: "Pending",
  completed: "Completed",
  paid: "Paid",
};

interface JobPickerProps {
  /** Jobs already ranked, in the order they should be shown */
  jobs: Job[];
  selectedJobId: Id<"jobs"> | null;
  onSelect: (jobId: Id<"jobs">) => void;
  /** Marks one job with a "Best match" label */
  recommendedJobId?: Id<"jobs"> | null;
  /**
   * Group heading for a job, e.g. "On today's route". A heading shows whenever the label changes
   * from the previous row, so keep jobs of the same group next to each other.
   */
  getSectionLabel?: (job: Job) => string | undefined;
}

/**
 * A big, easy-to-tap list for choosing a job, like the web's JobPicker. The street address is
 * the headline of each row.
 */
export function JobPicker({
  jobs,
  selectedJobId,
  onSelect,
  recommendedJobId,
  getSectionLabel,
}: JobPickerProps) {
  return (
    <View accessibilityRole="radiogroup" style={styles.list}>
      {jobs.map((job, index) => {
        const sectionLabel = getSectionLabel?.(job);
        const isNewSection =
          sectionLabel !== undefined &&
          (index === 0 || getSectionLabel?.(jobs[index - 1]) !== sectionLabel);

        return (
          <View key={job._id} style={styles.list}>
            {isNewSection ?
              <SectionLabel style={[styles.sectionLabel, index > 0 && styles.sectionGap]}>
                {sectionLabel}
              </SectionLabel>
            : null}
            <JobPickerRow
              job={job}
              isSelected={job._id === selectedJobId}
              isRecommended={job._id === recommendedJobId}
              onSelect={() => onSelect(job._id)}
            />
          </View>
        );
      })}
    </View>
  );
}

interface JobPickerRowProps {
  job: Job;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}

function JobPickerRow({ job, isSelected, isRecommended, onSelect }: JobPickerRowProps) {
  const { colors } = useTheme();
  const details = [STATUS_LABELS[job.status], job.dueDate && `Due ${formatDueDate(job.dueDate)}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${isRecommended ? "Best match. " : ""}${job.address}. ${details}`}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: isSelected ? colors.primary : colors.border,
          backgroundColor: isSelected ? `${colors.primary}1A` : colors.card,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.rowText}>
        {isRecommended ?
          <View
            style={[
              styles.badge,
              { borderColor: colors.success, backgroundColor: `${colors.success}1A` },
            ]}
          >
            <SymbolView name="star.fill" size={16} tintColor={colors.success} />
            <Text variant="caption" style={{ color: colors.success, fontWeight: "700" }}>
              Best match
            </Text>
          </View>
        : null}
        <Text variant="label" numberOfLines={3}>
          {job.address}
        </Text>
        <Text variant="caption" tone="muted">
          {details}
        </Text>
      </View>
      <View
        style={[
          styles.radio,
          {
            borderColor: isSelected ? colors.primary : colors.mutedForeground,
            backgroundColor: isSelected ? colors.primary : "transparent",
          },
        ]}
      >
        {isSelected ?
          <SymbolView
            name="checkmark"
            size={20}
            weight="bold"
            tintColor={colors.primaryForeground}
          />
        : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  sectionLabel: { paddingHorizontal: space.xs },
  sectionGap: { paddingTop: space.md },
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: 2,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  rowText: { flex: 1, gap: space.xs, alignItems: "flex-start" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  radio: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
