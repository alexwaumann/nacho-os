import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchHourlyForecast, mapWmoCodeToCondition, toSlot } from "./weather";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mapWmoCodeToCondition", () => {
  it("maps WMO codes to plain conditions", () => {
    expect(mapWmoCodeToCondition(0)).toBe("Sunny");
    expect(mapWmoCodeToCondition(2)).toBe("Cloudy");
    expect(mapWmoCodeToCondition(45)).toBe("Foggy");
    expect(mapWmoCodeToCondition(63)).toBe("Rainy");
    expect(mapWmoCodeToCondition(73)).toBe("Snowy");
    expect(mapWmoCodeToCondition(81)).toBe("Showers");
    expect(mapWmoCodeToCondition(85)).toBe("Snow Showers");
    expect(mapWmoCodeToCondition(95)).toBe("Thunderstorm");
  });
});

describe("toSlot", () => {
  it("converts an Open-Meteo reading into a forecast slot", () => {
    expect(toSlot(1_700_000_000, 71.6, 61, 1, 40)).toEqual({
      time: 1_700_000_000_000,
      temp: 72,
      precipProb: 40,
      code: 61,
      condition: "Rainy",
      isDay: true,
    });
  });

  it("treats a missing precipitation chance as zero", () => {
    expect(toSlot(0, 50, 0, 0, null)).toMatchObject({ precipProb: 0, isDay: false });
  });
});

describe("fetchHourlyForecast", () => {
  it("returns current conditions and the hourly slots", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          current: {
            time: 100,
            temperature_2m: 70.4,
            weather_code: 0,
            is_day: 1,
            precipitation_probability: 0,
          },
          hourly: {
            time: [3600, 7200],
            temperature_2m: [71, 72],
            weather_code: [1, 61],
            is_day: [1, 0],
            precipitation_probability: [10, 60],
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const forecast = await fetchHourlyForecast({ lat: 30.27, lng: -97.74 }, 16);

    expect(fetchMock.mock.calls[0][0]).toContain("latitude=30.27&longitude=-97.74");
    expect(fetchMock.mock.calls[0][0]).toContain("forecast_hours=16");
    expect(forecast.current).toMatchObject({ time: 100_000, temp: 70, condition: "Sunny" });
    expect(forecast.hourly.map((slot) => slot.condition)).toEqual(["Cloudy", "Rainy"]);
  });

  it("throws when Open-Meteo fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Bad Gateway",
        json: () => Promise.resolve({}),
      }),
    );

    await expect(fetchHourlyForecast({ lat: 0, lng: 0 })).rejects.toThrow(
      "Weather API Error: Bad Gateway",
    );
  });

  it("throws when the forecast is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );

    await expect(fetchHourlyForecast({ lat: 0, lng: 0 })).rejects.toThrow(
      "Weather API returned no forecast",
    );
  });
});
