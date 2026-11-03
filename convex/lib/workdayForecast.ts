// Today's hourly forecast at a job site, for the route brief (Open-Meteo, no API key required)

export type Coordinates = {
  lat: number;
  lng: number;
};

export type WorkdayForecastSlot = {
  /** Unix time (ms) of the start of the hour */
  time: number;
  temp: number;
  precipProb: number;
  code: number;
  condition: string;
  isDay: boolean;
  windMph: number;
  gustMph: number;
};

function mapWmoCodeToCondition(wmoCode: number): string {
  if (wmoCode === 0) return "Sunny";
  if (wmoCode <= 3) return "Cloudy";
  if (wmoCode <= 48) return "Foggy";
  if (wmoCode <= 67) return "Rainy";
  if (wmoCode <= 77) return "Snowy";
  if (wmoCode <= 82) return "Showers";
  if (wmoCode <= 86) return "Snow Showers";
  return "Thunderstorm";
}

const FIELDS =
  "temperature_2m,weather_code,is_day,precipitation_probability,wind_speed_10m,wind_gusts_10m";

/**
 * Today's hourly forecast at a site (midnight to midnight, the site's local time), with wind.
 */
export async function getTodayHourlyForecast(
  coordinates: Coordinates,
): Promise<Array<WorkdayForecastSlot>> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lng}&hourly=${FIELDS}&temperature_unit=fahrenheit&wind_speed_unit=mph&timeformat=unixtime&timezone=auto&forecast_days=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather API Error: ${response.statusText}`);
  }

  const result = await response.json();
  const hourly = result?.hourly;

  if (!hourly?.time) {
    throw new Error("Weather API returned no forecast");
  }

  return hourly.time.map((time: number, i: number) => {
    const code: number = hourly.weather_code[i];
    return {
      time: time * 1000,
      temp: Math.round(hourly.temperature_2m[i]),
      precipProb: hourly.precipitation_probability[i] ?? 0,
      code,
      condition: mapWmoCodeToCondition(code),
      isDay: hourly.is_day[i] === 1,
      windMph: Math.round(hourly.wind_speed_10m[i] ?? 0),
      gustMph: Math.round(hourly.wind_gusts_10m[i] ?? 0),
    };
  });
}
