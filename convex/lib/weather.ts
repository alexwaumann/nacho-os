// Open-Meteo forecasts (no API key required). Safe to import from both Convex and the browser.
import type { Coordinates } from "./routing";

export type { Coordinates } from "./routing";

export type HourlyForecastSlot = {
  // Unix time (ms) of the start of the hour, or of the reading for current conditions
  time: number;
  temp: number;
  precipProb: number;
  code: number;
  condition: string;
  isDay: boolean;
};

export type HourlyForecast = {
  current: HourlyForecastSlot;
  hourly: Array<HourlyForecastSlot>;
};

export type WorkdayForecastSlot = HourlyForecastSlot & {
  windMph: number;
  gustMph: number;
};

export function mapWmoCodeToCondition(wmoCode: number): string {
  if (wmoCode === 0) return "Sunny";
  if (wmoCode <= 3) return "Cloudy";
  if (wmoCode <= 48) return "Foggy";
  if (wmoCode <= 67) return "Rainy";
  if (wmoCode <= 77) return "Snowy";
  if (wmoCode <= 82) return "Showers";
  if (wmoCode <= 86) return "Snow Showers";
  return "Thunderstorm";
}

const HOURLY_FIELDS = "temperature_2m,weather_code,is_day,precipitation_probability";

export function toSlot(
  time: number,
  temp: number,
  code: number,
  isDay: number,
  precipProb: number | null,
): HourlyForecastSlot {
  return {
    time: time * 1000,
    temp: Math.round(temp),
    precipProb: precipProb ?? 0,
    code,
    condition: mapWmoCodeToCondition(code),
    isDay: isDay === 1,
  };
}

/**
 * Current conditions plus the hourly forecast starting at the current hour
 */
export async function fetchHourlyForecast(
  coordinates: Coordinates,
  hours = 8,
): Promise<HourlyForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lng}&current=${HOURLY_FIELDS}&hourly=${HOURLY_FIELDS}&temperature_unit=fahrenheit&timeformat=unixtime&forecast_hours=${hours}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API Error: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result?.current || !result?.hourly) {
    throw new Error("Weather API returned no forecast");
  }

  const { current, hourly } = result;

  return {
    current: toSlot(
      current.time,
      current.temperature_2m,
      current.weather_code,
      current.is_day,
      current.precipitation_probability,
    ),
    hourly: hourly.time.map((time: number, i: number) =>
      toSlot(
        time,
        hourly.temperature_2m[i],
        hourly.weather_code[i],
        hourly.is_day[i],
        hourly.precipitation_probability[i],
      ),
    ),
  };
}

const WORKDAY_FIELDS = `${HOURLY_FIELDS},wind_speed_10m,wind_gusts_10m`;

/**
 * Today's hourly forecast at a site (midnight to midnight, the site's local time), with wind.
 */
export async function getTodayHourlyForecast(
  coordinates: Coordinates,
): Promise<Array<WorkdayForecastSlot>> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lng}&hourly=${WORKDAY_FIELDS}&temperature_unit=fahrenheit&wind_speed_unit=mph&timeformat=unixtime&timezone=auto&forecast_days=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API Error: ${response.statusText}`);
  }

  const result = await response.json();
  const hourly = result?.hourly;

  if (!hourly?.time) {
    throw new Error("Weather API returned no forecast");
  }

  return hourly.time.map((time: number, i: number) => ({
    ...toSlot(
      time,
      hourly.temperature_2m[i],
      hourly.weather_code[i],
      hourly.is_day[i],
      hourly.precipitation_probability[i],
    ),
    windMph: Math.round(hourly.wind_speed_10m[i] ?? 0),
    gustMph: Math.round(hourly.wind_gusts_10m[i] ?? 0),
  }));
}
