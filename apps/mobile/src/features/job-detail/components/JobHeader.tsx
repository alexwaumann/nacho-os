import { SymbolView } from "expo-symbols";
import { ActionSheetIOS, Pressable, StyleSheet, View } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import { formatIsoDate } from "@shared/calendar";
import { getDueBadge } from "@shared/jobs/dueDate";
import { getStatusActions, splitAccessCode, STATUS_LABELS } from "@shared/jobs/jobSheet";
import { Text } from "@/components/ui/text";
import { toastError } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { openDirectionsTo } from "@/lib/directions";
import { minTapSize, radius, space } from "@/lib/theme";

import type { useJobMutations } from "../hooks/useJobMutations";
import { ActionButton, IconButton, Pill } from "./SheetParts";
import { confirmStatusChange, STATUS_ACTIONS, STATUS_TONES } from "./StatusSection";

interface JobHeaderProps {
  job: Doc<"jobs">;
  mutations: ReturnType<typeof useJobMutations>;
  onDelete: () => void;
}

/** Address, status and due date, Directions, the route switch and the More menu */
export function JobHeader({ job, mutations, onDelete }: JobHeaderProps) {
  const { colors } = useTheme();
  const dueBadge = job.status === "pending" ? getDueBadge(job.dueDate, new Date()) : null;
  const accessCodes = job.accessCodes ?? [];
  // On a route day he reads the codes at the door, so they ride in the header
  const hasHeaderCodes = job.selectedForRoute && accessCodes.length > 0;

  const handleDirections = async () => {
    try {
      await openDirectionsTo(job.address);
    } catch (error) {
      toastError("Couldn't open Google Maps", error);
    }
  };

  const handleMore = () => {
    const statuses = getStatusActions(job.status);
    const options = [
      ...statuses.map((status) => STATUS_ACTIONS[status].title),
      "Delete job",
      "Cancel",
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: job.address,
        options,
        destructiveButtonIndex: statuses.length,
        cancelButtonIndex: statuses.length + 1,
      },
      (index) => {
        if (index < statuses.length) confirmStatusChange(statuses[index], mutations.setStatus);
        else if (index === statuses.length) onDelete();
      },
    );
  };

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text variant="title" style={styles.address} selectable>
          {job.address}
        </Text>
        {/* VOICE: the per-job mic button goes here, next to More (a later PR) */}
        <IconButton icon="ellipsis" accessibilityLabel="More actions" onPress={handleMore} />
      </View>

      <View style={styles.pills}>
        <Pill label={STATUS_LABELS[job.status]} tone={STATUS_TONES[job.status]} />
        {job.status === "pending" && job.dueDate ?
          <Pill
            label={
              dueBadge === "overdue" ? `Overdue · ${formatIsoDate(job.dueDate)}`
              : dueBadge === "today" ?
                "Due today"
              : `Due ${formatIsoDate(job.dueDate)}`
            }
            tone={dueBadge === "overdue" ? "destructive" : "warning"}
            icon={dueBadge === "overdue" ? "exclamationmark.triangle.fill" : "calendar"}
          />
        : null}
      </View>

      {hasHeaderCodes ?
        <View style={styles.codes} accessibilityLabel="Access codes">
          {accessCodes.map((code, i) => {
            const { label, value } = splitAccessCode(code);
            return (
              <View
                key={`${i}-${code}`}
                style={[
                  styles.code,
                  { borderColor: colors.primary, backgroundColor: `${colors.primary}1A` },
                ]}
              >
                <SymbolView name="key.fill" size={18} tintColor={colors.primary} />
                {label ?
                  <Text variant="label">{label}</Text>
                : null}
                <Text variant="heading" style={styles.mono}>
                  {value}
                </Text>
              </View>
            );
          })}
        </View>
      : null}

      <ActionButton
        title="Directions"
        icon="car.fill"
        variant="primary"
        onPress={() => void handleDirections()}
      />

      {/* The whole row is the switch, so tapping anywhere flips it */}
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: job.selectedForRoute }}
        accessibilityLabel="On today's route"
        onPress={() => void mutations.setOnRoute(!job.selectedForRoute)}
        style={({ pressed }) => [
          styles.routeRow,
          { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <SymbolView
          name={job.selectedForRoute ? "map.fill" : "map"}
          size={24}
          tintColor={job.selectedForRoute ? colors.primary : colors.mutedForeground}
        />
        <Text variant="label" style={styles.flex}>
          On today&apos;s route
        </Text>
        {/* Drawn here, not React Native's Switch: its fixed frame sits off-center on iOS 26+ */}
        <View
          style={[
            styles.toggle,
            { backgroundColor: job.selectedForRoute ? colors.primary : colors.border },
            job.selectedForRoute && styles.toggleOn,
          ]}
        >
          <View style={styles.knob} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  address: { flex: 1, paddingTop: space.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  codes: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  code: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  mono: { fontFamily: "Menlo", letterSpacing: 1 },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTapSize + space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  flex: { flex: 1 },
  toggle: { width: 64, height: 36, borderRadius: 18, padding: 3, justifyContent: "center" },
  toggleOn: { alignItems: "flex-end" },
  knob: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
