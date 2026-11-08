import { SymbolView } from "expo-symbols";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import type { Coordinates, HourlyForecastSlot } from "@convex/lib/weather";
import { formatArrivalTime } from "@shared/jobs/arrival";
import { Text } from "@/components/ui/text";
import { useHourlyForecast } from "@/features/route/hooks/useHourlyForecast";
import { useScaledSize } from "@/hooks/useScaledSize";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/lib/theme";

import { getTodayColors } from "../lib/todayColors";
import { getWeatherSymbol } from "../lib/weatherSymbol";

// Only call out rain when it's reasonably likely
const PRECIP_THRESHOLD = 20;
// Five columns have to fit the card, so the strip grows less with Dynamic Type than body text
// (and shrinks a label to fit past that)
const STRIP_MAX_SCALE = 1.5;

function formatHour(time: number) {
  return new Date(time).toLocaleTimeString([], { hour: "numeric" });
}

interface HourlyForecastStripProps {
  coordinates: Coordinates | undefined;
  /** Estimated arrival (ms); the nearest hour is highlighted */
  arrivalTime?: number;
  /** Words for the arrival line, e.g. "You get there around" (none: no line) */
  arrivalLabel?: string;
}

/** Now and the next four hours at a site, with the hour he gets there highlighted. */
export function HourlyForecastStrip({
  coordinates,
  arrivalTime,
  arrivalLabel,
}: HourlyForecastStripProps) {
  const { colors } = useTheme();
  const { slots, arrivalIndex, isLoading } = useHourlyForecast(coordinates, 4, arrivalTime);

  // Keep the columns aligned: show the rain row for every hour, or for none
  const hasRainChance = slots?.some((slot) => slot.precipProb >= PRECIP_THRESHOLD) ?? false;

  const arrivalLine =
    arrivalTime !== undefined && arrivalLabel ?
      <Text variant="label">
        {arrivalLabel} {formatArrivalTime(arrivalTime)}
      </Text>
    : null;

  if (isLoading) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.strip, styles.loading, { backgroundColor: colors.muted }]}>
          <ActivityIndicator accessibilityLabel="Loading the weather" />
        </View>
        {arrivalLine}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {slots ?
        <View style={[styles.strip, { backgroundColor: colors.muted }]}>
          {slots.map((slot, index) => (
            <ForecastSlot
              key={slot.time}
              slot={slot}
              isNow={index === 0}
              isArrival={index === arrivalIndex}
              showRainChance={hasRainChance}
            />
          ))}
        </View>
      : null}
      {arrivalLine}
    </View>
  );
}

interface ForecastSlotProps {
  slot: HourlyForecastSlot;
  isNow: boolean;
  isArrival: boolean;
  showRainChance: boolean;
}

function ForecastSlot({ slot, isNow, isArrival, showRainChance }: ForecastSlotProps) {
  const { scheme, colors } = useTheme();
  const today = getTodayColors(scheme);
  const symbol = getWeatherSymbol(slot.code, slot.isDay, today);
  const label = isNow ? "Now" : formatHour(slot.time);
  const arrivalHint = isArrival ? ", about when you get there" : "";
  const isRainy = slot.precipProb >= PRECIP_THRESHOLD;
  const iconSize = useScaledSize(22, STRIP_MAX_SCALE);

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${slot.temp} degrees, ${slot.condition}, ${slot.precipProb}% chance of rain${arrivalHint}`}
      style={[
        styles.slot,
        isNow && { backgroundColor: colors.card },
        isArrival && {
          backgroundColor: today.primaryTint,
          borderColor: colors.primary,
          borderWidth: 2,
        },
      ]}
    >
      <Text
        variant="footnote"
        style={[
          styles.hour,
          { color: isNow || isArrival ? colors.primary : colors.mutedForeground },
        ]}
        maxFontSizeMultiplier={STRIP_MAX_SCALE}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
      <SymbolView name={symbol.name} size={iconSize} tintColor={symbol.color} />
      <Text
        variant="label"
        style={styles.temp}
        maxFontSizeMultiplier={STRIP_MAX_SCALE}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {slot.temp}°
      </Text>
      {showRainChance ?
        <Text
          variant="footnote"
          style={[styles.rain, { color: today.rain, opacity: isRainy ? 1 : 0 }]}
          maxFontSizeMultiplier={STRIP_MAX_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {slot.precipProb}%
        </Text>
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  strip: {
    flexDirection: "row",
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  loading: { minHeight: 84, alignItems: "center", justifyContent: "center" },
  slot: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    borderWidth: 2,
    borderColor: "transparent",
  },
  hour: { fontWeight: "600" },
  temp: { fontWeight: "700" },
  rain: { fontWeight: "600" },
});
