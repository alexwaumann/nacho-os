import { createServerFn } from "@tanstack/react-start";

// Type definitions
export type Coordinates = {
  lat: number;
  lng: number;
};

export type WeatherData = {
  tempMax: number;
  precipProb: number;
  condition: string;
  code: number;
};

// Helper to map Open-Meteo WMO codes to internal simple codes
function mapWmoCodeToInternal(wmoCode: number): number {
  // Open-Meteo WMO codes: https://open-meteo.com/en/docs
  // 0: Clear sky
  if (wmoCode === 0) return 0;
  // 1, 2, 3: Mainly clear, partly cloudy, and overcast
  if (wmoCode <= 3) return 3;
  // 45, 48: Fog
  if (wmoCode <= 48) return 3;
  // 51, 53, 55: Drizzle
  if (wmoCode <= 55) return 61;
  // 56, 57: Freezing Drizzle
  if (wmoCode <= 57) return 71;
  // 61, 63, 65: Rain
  if (wmoCode <= 65) return 61;
  // 66, 67: Freezing Rain
  if (wmoCode <= 67) return 71;
  // 71, 73, 75: Snow fall
  if (wmoCode <= 75) return 71;
  // 77: Snow grains
  if (wmoCode === 77) return 71;
  // 80, 81, 82: Rain showers
  if (wmoCode <= 82) return 61;
  // 85, 86: Snow showers
  if (wmoCode <= 86) return 71;
  // 95: Thunderstorm
  if (wmoCode === 95) return 95;
  // 96, 99: Thunderstorm with hail
  if (wmoCode >= 96) return 95;

  return 3; // Default to cloudy
}

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

/**
 * Fetch weather data from Open-Meteo API (no API key required)
 */
export const fetchWeather = createServerFn({ method: "POST" })
  .inputValidator((data: { coordinates: Coordinates }) => data)
  .handler(async ({ data }) => {
    const { coordinates } = data;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lng}&daily=weather_code,temperature_2m_max,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Weather API Error: ${response.statusText}`);
      return null;
    }

    const result = await response.json();

    if (result?.daily) {
      const tempMax = result.daily.temperature_2m_max[0];
      const precipProb = result.daily.precipitation_probability_max[0];
      const weatherCode = result.daily.weather_code[0];

      return {
        tempMax: Math.round(tempMax),
        precipProb: precipProb,
        condition: mapWmoCodeToCondition(weatherCode),
        code: mapWmoCodeToInternal(weatherCode),
      } as WeatherData;
    }

    return null;
  });

/**
 * Fetch extended weather forecast (7 days)
 */
export const fetchExtendedForecast = createServerFn({ method: "POST" })
  .inputValidator((data: { coordinates: Coordinates; days?: number }) => data)
  .handler(async ({ data }) => {
    const { coordinates, days = 7 } = data;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=${days}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Weather API Error: ${response.statusText}`);
      return null;
    }

    const result = await response.json();

    if (result?.daily) {
      return result.daily.time.map((date: string, i: number) => ({
        date,
        tempMax: Math.round(result.daily.temperature_2m_max[i]),
        tempMin: Math.round(result.daily.temperature_2m_min[i]),
        precipProb: result.daily.precipitation_probability_max[i],
        condition: mapWmoCodeToCondition(result.daily.weather_code[i]),
        code: mapWmoCodeToInternal(result.daily.weather_code[i]),
      }));
    }

    return null;
  });
