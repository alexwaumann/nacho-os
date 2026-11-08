import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { addDays, getMonthGrid, parseIsoDate, shiftMonth, toIsoDay } from "@shared/calendar";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/useTheme";
import { minTapSize, radius, space } from "@/lib/theme";

import { ModalShell } from "./EditModal";
import { ActionButton, IconButton } from "./SheetParts";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  /** The saved date (YYYY-MM-DD); free text or none starts on this month */
  value: string | undefined;
  onPick: (date: string) => void;
  /** Offered as a "Remove due date" button when given */
  onClear?: () => void;
  onCancel: () => void;
}

/**
 * Pick a day with one tap: shortcuts (Today, Tomorrow, Next week…) or a month calendar.
 * Plain JavaScript, so it needs no native date picker in the app build.
 */
export function DatePickerModal({ visible, ...props }: DatePickerModalProps) {
  return visible ? <DatePickerBody {...props} /> : null;
}

function DatePickerBody({
  title,
  value,
  onPick,
  onClear,
  onCancel,
}: Omit<DatePickerModalProps, "visible">) {
  const { colors } = useTheme();
  const today = new Date();
  const todayIso = toIsoDay(today);
  const selected = parseIsoDate(value) ? value : undefined;
  const start = parseIsoDate(selected) ?? today;
  const [shown, setShown] = useState({ year: start.getFullYear(), month: start.getMonth() });

  const monthName = new Date(shown.year, shown.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const shortcuts = [
    { label: "Today", date: todayIso },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "In 1 week", date: addDays(today, 7) },
    { label: "In 2 weeks", date: addDays(today, 14) },
  ];

  return (
    <ModalShell visible title={title} onCancel={onCancel}>
      <View style={styles.shortcuts}>
        {shortcuts.map((shortcut) => (
          <ActionButton
            key={shortcut.label}
            title={shortcut.label}
            variant={shortcut.date === selected ? "primary" : "secondary"}
            onPress={() => onPick(shortcut.date)}
            style={styles.shortcut}
          />
        ))}
      </View>

      <View style={styles.monthBar}>
        <IconButton
          icon="chevron.left"
          accessibilityLabel="Previous month"
          onPress={() => setShown(shiftMonth(shown.year, shown.month, -1))}
        />
        <Text variant="heading" style={styles.monthName} accessibilityLiveRegion="polite">
          {monthName}
        </Text>
        <IconButton
          icon="chevron.right"
          accessibilityLabel="Next month"
          onPress={() => setShown(shiftMonth(shown.year, shown.month, 1))}
        />
      </View>

      <View accessibilityRole="none">
        <View style={styles.week}>
          {WEEKDAYS.map((day, i) => (
            <Text
              key={i}
              variant="footnote"
              tone="muted"
              style={styles.weekday}
              maxFontSizeMultiplier={1.6}
              accessibilityElementsHidden
            >
              {day}
            </Text>
          ))}
        </View>
        {getMonthGrid(shown.year, shown.month).map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((date, d) => {
              if (!date) return <View key={d} style={styles.day} />;
              const isSelected = date === selected;
              const isToday = date === todayIso;
              const dayDate = parseIsoDate(date)!;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${WEEKDAY_NAMES[d]} ${dayDate.toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                  })}${isToday ? ", today" : ""}`}
                  onPress={() => onPick(date)}
                  style={({ pressed }) => [
                    styles.day,
                    styles.dayButton,
                    isSelected && { backgroundColor: colors.primary },
                    !isSelected && isToday && { borderColor: colors.primary, borderWidth: 2 },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text
                    variant="label"
                    tone={isSelected ? "onPrimary" : "default"}
                    // Seven days across: the grid can't grow much wider
                    maxFontSizeMultiplier={1.6}
                  >
                    {dayDate.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {onClear ?
        <ActionButton
          title="Remove due date"
          icon="xmark.circle"
          variant="outline"
          onPress={onClear}
        />
      : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  shortcut: { flexGrow: 1, flexBasis: "45%" },
  monthBar: { flexDirection: "row", alignItems: "center", gap: space.sm },
  monthName: { flex: 1, textAlign: "center" },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", paddingVertical: space.xs, fontWeight: "600" },
  day: { flex: 1, aspectRatio: 1, maxHeight: minTapSize + 8, margin: 1 },
  dayButton: { alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
});
