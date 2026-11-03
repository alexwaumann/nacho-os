import { SymbolView } from "expo-symbols";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import type { Doc } from "@convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import type { UseRouteBriefResult } from "@/features/route/hooks/useRouteBrief";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

import type { SFSymbol } from "../lib/symbols";
import { getTodayColors } from "../lib/todayColors";
import type { TodayColors } from "../lib/todayColors";
import { ActionButton } from "./ActionButton";

type Severity = NonNullable<Doc<"routeBriefs">["severity"]>;

function getSeverityLook(severity: Severity, today: TodayColors) {
  const looks: Record<Severity, { icon: SFSymbol; color: string; isAlert: boolean }> = {
    calm: { icon: "sun.max.fill", color: today.sun, isAlert: false },
    watch: { icon: "cloud.fill", color: today.cloud, isAlert: false },
    act: { icon: "cloud.rain.fill", color: today.rain, isAlert: true },
  };
  return looks[severity];
}

function formatTime(time: number) {
  return new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface RouteBriefCardProps {
  /** From useRouteBrief, so the Today screen can share it with the stop cards */
  routeBrief: UseRouteBriefResult;
}

/**
 * Today's weather brief for the route: a plain headline, and a suggested order of stops he can
 * accept or dismiss with one tap.
 */
export function RouteBriefCard({ routeBrief }: RouteBriefCardProps) {
  const { scheme, colors } = useTheme();
  const today = getTodayColors(scheme);
  const { brief, suggestion, canRefresh, isGenerating, isApplying, error } = routeBrief;

  if (!canRefresh) return null;

  if (!brief) {
    if (isGenerating) {
      return (
        <Card style={styles.row}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="label" style={styles.flex}>
            Checking the weather at your stops…
          </Text>
        </Card>
      );
    }

    if (error) {
      return (
        <Card style={{ borderColor: colors.destructive }}>
          <Text variant="label">Couldn&apos;t check the weather at your stops.</Text>
          <Text tone="muted">{error}</Text>
          <ActionButton
            title="Try again"
            icon="arrow.clockwise"
            onPress={() => void routeBrief.refresh()}
          />
        </Card>
      );
    }

    return (
      <ActionButton
        title="Check weather"
        icon="cloud.sun.fill"
        onPress={() => void routeBrief.refresh()}
      />
    );
  }

  const look = getSeverityLook(brief.severity ?? "watch", today);

  return (
    <View style={styles.stack}>
      <Card
        style={
          look.isAlert ?
            { backgroundColor: today.warningBackground, borderColor: today.warningBorder }
          : undefined
        }
      >
        <View style={styles.headline}>
          <SymbolView name={look.icon} size={34} tintColor={look.color} />
          <Text variant="label" style={styles.flex}>
            {brief.headline}
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          {error ? "Couldn't check again." : `Checked at ${formatTime(brief.generatedAt)}`}
        </Text>
        <ActionButton
          title={isGenerating ? "Checking…" : "Check again"}
          icon="arrow.clockwise"
          isLoading={isGenerating}
          onPress={() => void routeBrief.refresh()}
        />
      </Card>

      {suggestion ?
        <Card style={[styles.suggestion, { borderColor: colors.primary }]}>
          <View style={styles.row}>
            <SymbolView name="list.number" size={26} tintColor={colors.primary} />
            <Text variant="heading" style={styles.flex}>
              Suggested order
            </Text>
          </View>
          <Text>{suggestion.reason}</Text>
          <View style={styles.stack}>
            {suggestion.jobs.map((job, index) => (
              <View key={job._id} style={styles.suggestedStop}>
                <View style={[styles.number, { backgroundColor: today.primaryTint }]}>
                  <Text variant="label" tone="primary" maxFontSizeMultiplier={1.4}>
                    {index + 1}
                  </Text>
                </View>
                <Text variant="label" style={styles.flex}>
                  {job.address}
                </Text>
              </View>
            ))}
          </View>
          <ActionButton
            title={isApplying ? "Changing the order…" : "Use this order"}
            variant="primary"
            isLoading={isApplying}
            onPress={() => void routeBrief.applySuggestion()}
          />
          <ActionButton
            title="Keep my order"
            disabled={isApplying}
            onPress={() => void routeBrief.dismissSuggestion()}
          />
        </Card>
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  headline: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  flex: { flex: 1 },
  suggestion: { borderWidth: 2, gap: space.md },
  suggestedStop: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  number: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
