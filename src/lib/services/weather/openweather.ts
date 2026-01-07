import type { WeatherData } from "@/lib/types";
import { ServiceError, requireEnv } from "@/lib/services/errors";
import type { WeatherOptions, WeatherService } from "@/lib/services/weather/types";

export class OpenWeatherService implements WeatherService {
  provider = "openweather";

  async getWeather(
    lat: number,
    lon: number,
    options: WeatherOptions = {}
  ): Promise<WeatherData> {
    const apiKey = requireEnv("OPENWEATHER_API_KEY");
    const units = options.units ?? "metric";
    const lang = options.lang ?? "de";

    // NOTE: One Call API 3.0 usually requires a separate subscription.
    // The free tier commonly supports the "Current weather" + "5 day / 3 hour forecast" APIs.

    const currentUrl = new URL("https://api.openweathermap.org/data/2.5/weather");
    currentUrl.searchParams.set("lat", lat.toString());
    currentUrl.searchParams.set("lon", lon.toString());
    currentUrl.searchParams.set("units", units);
    currentUrl.searchParams.set("lang", lang);
    currentUrl.searchParams.set("appid", apiKey);

    const forecastUrl = new URL("https://api.openweathermap.org/data/2.5/forecast");
    forecastUrl.searchParams.set("lat", lat.toString());
    forecastUrl.searchParams.set("lon", lon.toString());
    forecastUrl.searchParams.set("units", units);
    forecastUrl.searchParams.set("lang", lang);
    forecastUrl.searchParams.set("appid", apiKey);

    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl.toString()),
      fetch(forecastUrl.toString()),
    ]);

    if (!currentRes.ok) {
      const body = await currentRes.text();
      throw new ServiceError("Weather provider error (current)", {
        status: currentRes.status,
        code: "provider_error",
        details: body,
      });
    }

    if (!forecastRes.ok) {
      const body = await forecastRes.text();
      throw new ServiceError("Weather provider error (forecast)", {
        status: forecastRes.status,
        code: "provider_error",
        details: body,
      });
    }

    const current = (await currentRes.json()) as {
      main: { temp: number; humidity: number };
      wind?: { speed?: number };
      weather?: { description: string; icon: string }[];
      coord?: { lat: number; lon: number };
    };

    const forecast = (await forecastRes.json()) as {
      list: {
        dt: number;
        main: { temp_min: number; temp_max: number };
        weather?: { description: string; icon: string }[];
      }[];
    };

    // Aggregate 5-day/3-hour forecast into daily min/max.
    // OpenWeather free forecast is typically limited to ~5 days.
    type DayAgg = {
      dateKey: string;
      min: number;
      max: number;
      // pick a representative weather near midday if possible
      reprDt: number;
      reprDesc: string;
      reprIcon: string;
    };

    const byDay = new Map<string, DayAgg>();

    for (const item of forecast.list ?? []) {
      const dtMs = item.dt * 1000;
      const d = new Date(dtMs);
      const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD

      const min = item.main?.temp_min;
      const max = item.main?.temp_max;
      if (typeof min !== "number" || typeof max !== "number") continue;

      const desc = item.weather?.[0]?.description ?? "";
      const icon = item.weather?.[0]?.icon ?? "01d";

      const existing = byDay.get(dateKey);
      if (!existing) {
        byDay.set(dateKey, {
          dateKey,
          min,
          max,
          reprDt: item.dt,
          reprDesc: desc,
          reprIcon: icon,
        });
        continue;
      }

      existing.min = Math.min(existing.min, min);
      existing.max = Math.max(existing.max, max);

      // Prefer an entry around 12:00 local-ish (best-effort using UTC hour)
      const hour = d.getUTCHours();
      const existingHour = new Date(existing.reprDt * 1000).getUTCHours();
      const score = Math.abs(hour - 12);
      const existingScore = Math.abs(existingHour - 12);
      if (score < existingScore) {
        existing.reprDt = item.dt;
        existing.reprDesc = desc;
        existing.reprIcon = icon;
      }
    }

    const dailyAgg = Array.from(byDay.values())
      .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
      .slice(0, 7);

    // Pad to 7 days to satisfy UI expectations (free API often provides only 5 days)
    while (dailyAgg.length < 7) {
      const last = dailyAgg[dailyAgg.length - 1];
      if (!last) break;
      const nextDate = new Date(last.dateKey + "T00:00:00.000Z");
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextKey = nextDate.toISOString().slice(0, 10);
      dailyAgg.push({
        dateKey: nextKey,
        min: last.min,
        max: last.max,
        reprDt: Math.floor(nextDate.getTime() / 1000),
        reprDesc: last.reprDesc,
        reprIcon: last.reprIcon,
      });
    }

    return {
      provider: this.provider,
      location: { lat, lon },
      current: {
        tempC: current.main.temp,
        description: current.weather?.[0]?.description ?? "",
        icon: current.weather?.[0]?.icon ?? "01d",
        windKph: (current.wind?.speed ?? 0) * 3.6,
        humidity: current.main.humidity,
      },
      daily: dailyAgg.map((day) => ({
        date: new Date(day.reprDt * 1000).toISOString(),
        minC: day.min,
        maxC: day.max,
        description: day.reprDesc ?? "",
        icon: day.reprIcon ?? "01d",
      })),
    };
  }
}

export const getWeather = (
  lat: number,
  lon: number,
  options?: WeatherOptions
) => new OpenWeatherService().getWeather(lat, lon, options);
