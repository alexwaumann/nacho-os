import type { SFSymbol } from "./symbols";

import type { TodayColors } from "./todayColors";

/** The SF Symbol and color for an Open-Meteo WMO weather code (https://open-meteo.com/en/docs) */
export function getWeatherSymbol(
  code: number,
  isDay: boolean,
  colors: TodayColors,
): { name: SFSymbol; color: string } {
  if (code === 0) {
    return isDay ?
        { name: "sun.max.fill", color: colors.sun }
      : { name: "moon.fill", color: colors.moon };
  }
  if (code <= 2) {
    return isDay ?
        { name: "cloud.sun.fill", color: colors.sun }
      : { name: "cloud.moon.fill", color: colors.moon };
  }
  if (code === 3) return { name: "cloud.fill", color: colors.cloud };
  if (code <= 48) return { name: "cloud.fog.fill", color: colors.cloud };
  if (code <= 57) return { name: "cloud.drizzle.fill", color: colors.rain };
  if (code <= 67) return { name: "cloud.rain.fill", color: colors.rain };
  if (code <= 77) return { name: "cloud.snow.fill", color: colors.snow };
  if (code <= 82) return { name: "cloud.heavyrain.fill", color: colors.rain };
  if (code <= 86) return { name: "cloud.snow.fill", color: colors.snow };
  return { name: "cloud.bolt.rain.fill", color: colors.storm };
}
