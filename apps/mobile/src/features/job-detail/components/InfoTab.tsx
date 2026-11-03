import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import { formatIsoDate } from "@shared/calendar";
import { getDueBadge } from "@shared/jobs/dueDate";
import { addAccessCode, restoreAccessCode, splitAccessCode } from "@shared/jobs/jobSheet";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

import type { useJobMutations } from "../hooks/useJobMutations";
import { openImageViewer } from "../lib/imageViewer";
import { DatePickerModal } from "./DatePickerModal";
import { TextEditModal } from "./EditModal";
import { ActionButton, IconButton, Section, WARNING } from "./SheetParts";
import { StatusSection } from "./StatusSection";

type Mutations = ReturnType<typeof useJobMutations>;

interface InfoTabProps {
  job: Doc<"jobs">;
  sourceImages: string[] | undefined;
  mutations: Mutations;
}

/** Everything about the job that isn't tasks or money */
export function InfoTab({ job, sourceImages, mutations }: InfoTabProps) {
  return (
    <View style={styles.tab}>
      <StatusSection job={job} mutations={mutations} />

      {job.status === "pending" ?
        <DueDateSection dueDate={job.dueDate} onChange={mutations.setDueDate} />
      : null}

      <AccessCodesSection codes={job.accessCodes ?? []} onChange={mutations.setAccessCodes} />

      {job.summary ?
        <Section title="Scope summary">
          <Text>{job.summary}</Text>
        </Section>
      : null}

      <NotesSection notes={job.notes ?? ""} onSave={mutations.setNotes} />

      <WorkOrderSection images={sourceImages} />

      <Text variant="caption" tone="muted">
        Added{" "}
        {new Date(job._creationTime).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </Text>
    </View>
  );
}

function DueDateSection({
  dueDate,
  onChange,
}: {
  dueDate: string | undefined;
  onChange: Mutations["setDueDate"];
}) {
  const [isPicking, setIsPicking] = useState(false);
  const badge = getDueBadge(dueDate, new Date());

  const handlePick = (date: string | null) => {
    setIsPicking(false);
    if (date !== (dueDate ?? null)) void onChange(date);
  };

  return (
    <Section title="Due date">
      {dueDate ?
        <ActionButton
          title={
            badge === "overdue" ? `Overdue: ${formatIsoDate(dueDate)}`
            : badge === "today" ?
              `Due today`
            : `Due ${formatIsoDate(dueDate)}`
          }
          icon="calendar"
          variant="outline"
          accessibilityHint="Change the due date"
          onPress={() => setIsPicking(true)}
          style={[styles.leftButton, badge === "overdue" && { borderColor: WARNING }]}
        />
      : <ActionButton
          title="Add due date"
          icon="calendar.badge.plus"
          variant="outline"
          onPress={() => setIsPicking(true)}
          style={styles.leftButton}
        />
      }
      <DatePickerModal
        visible={isPicking}
        title={dueDate ? "Change due date" : "Add due date"}
        value={dueDate}
        onPick={handlePick}
        onClear={dueDate ? () => handlePick(null) : undefined}
        onCancel={() => setIsPicking(false)}
      />
    </Section>
  );
}

/** Lockbox and gate codes: copy one with a tap, add, or remove (with Undo) */
export function AccessCodesSection({
  codes,
  onChange,
}: {
  codes: string[];
  onChange: Mutations["setAccessCodes"];
}) {
  const { colors } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  // The codes as they are now, for an Undo pressed after other edits
  const latestCodes = useRef(codes);
  useEffect(() => {
    latestCodes.current = codes;
  }, [codes]);

  const handleCopy = async (code: string) => {
    await Clipboard.setStringAsync(splitAccessCode(code).value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success("Code copied", { description: splitAccessCode(code).value });
  };

  // Removing is one tap, with Undo on the toast (like the web app)
  const handleRemove = (index: number) => {
    const removed = codes[index];
    void onChange(codes.filter((_, i) => i !== index)).then((isSaved) => {
      if (!isSaved) return;
      toast.success(`Removed code ${removed}`, {
        action: {
          label: "Undo",
          // The list may have changed since; put it back where it was in the latest one
          onPress: () => void onChange(restoreAccessCode(latestCodes.current, index, removed)),
        },
      });
    });
  };

  const handleAdd = (code: string) => {
    setIsAdding(false);
    if (code.trim()) void onChange(addAccessCode(codes, code));
  };

  return (
    <Section title="Access codes">
      {codes.map((code, i) => {
        const { label, value } = splitAccessCode(code);
        return (
          <View
            key={`${i}-${code}`}
            style={[styles.codeRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label ?? "Code"} ${value}`}
              accessibilityHint="Copies the code"
              onPress={() => void handleCopy(code)}
              style={({ pressed }) => [styles.codeBody, pressed && { opacity: 0.6 }]}
            >
              <SymbolView name="key.fill" size={22} tintColor={colors.primary} />
              <View style={styles.codeText}>
                {label ?
                  <Text variant="caption" tone="muted">
                    {label}
                  </Text>
                : null}
                <Text variant="heading" style={styles.mono} selectable>
                  {value}
                </Text>
              </View>
              <SymbolView name="doc.on.doc" size={22} tintColor={colors.mutedForeground} />
            </Pressable>
            <IconButton
              icon="xmark"
              accessibilityLabel={`Remove code ${code}`}
              tint={colors.destructive}
              background="transparent"
              onPress={() => handleRemove(i)}
            />
          </View>
        );
      })}
      <ActionButton
        title="Add code"
        icon="plus"
        variant="outline"
        onPress={() => setIsAdding(true)}
        style={styles.leftButton}
      />
      <TextEditModal
        visible={isAdding}
        title="Add access code"
        initialValue=""
        placeholder="Like Lockbox: 7731"
        onSave={handleAdd}
        onCancel={() => setIsAdding(false)}
      />
    </Section>
  );
}

function NotesSection({ notes, onSave }: { notes: string; onSave: Mutations["setNotes"] }) {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (draft: string) => {
    setIsEditing(false);
    if (draft !== notes) void onSave(draft);
  };

  return (
    <Section title="Job notes">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={notes ? `Job notes: ${notes}` : "Add job notes"}
        accessibilityHint={notes ? "Edit the notes" : undefined}
        onPress={() => setIsEditing(true)}
        style={({ pressed }) => [
          styles.notes,
          { backgroundColor: colors.muted, borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text tone={notes ? "default" : "muted"} style={styles.flex}>
          {notes || "Add private notes about this job"}
        </Text>
        <SymbolView name="pencil" size={22} tintColor={colors.mutedForeground} />
      </Pressable>
      <TextEditModal
        visible={isEditing}
        title={notes ? "Edit notes" : "Add notes"}
        initialValue={notes}
        placeholder="Private notes about this job"
        isMultiline
        canSaveEmpty
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    </Section>
  );
}

/** The work order's pages (PDFs are stored as one image per page); tap one to see it big */
function WorkOrderSection({ images }: { images: string[] | undefined }) {
  const { colors } = useTheme();
  if (!images || images.length === 0) return null;

  const viewerImages = images.map((uri, i) => ({
    uri,
    caption: images.length > 1 ? `Work order, page ${i + 1}` : "Work order",
  }));

  return (
    <Section title="Work order">
      <View style={styles.pages}>
        {images.map((uri, i) => (
          <Pressable
            key={uri}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Work order page ${i + 1} of ${images.length}`}
            onPress={() => openImageViewer(viewerImages, i)}
            style={({ pressed }) => [
              styles.page,
              { backgroundColor: colors.muted, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Image source={{ uri }} style={styles.fill} contentFit="cover" transition={150} />
            <View style={styles.pageNumber}>
              <Text variant="caption" style={styles.white} maxFontSizeMultiplier={1.3}>
                {i + 1}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  tab: { gap: space.xl },
  leftButton: { alignSelf: "flex-start" },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingLeft: space.lg,
    paddingRight: space.xs,
  },
  codeBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTapSize + space.lg,
    paddingVertical: space.sm,
  },
  codeText: { flex: 1 },
  mono: { fontFamily: "Menlo", letterSpacing: 1 },
  notes: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    minHeight: minTapSize + space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  flex: { flex: 1 },
  pages: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  page: {
    width: "30%",
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  fill: { width: "100%", height: "100%" },
  pageNumber: {
    position: "absolute",
    bottom: space.xs,
    right: space.xs,
    minWidth: 28,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
  },
  white: { color: "#fff", fontWeight: "700" },
});
