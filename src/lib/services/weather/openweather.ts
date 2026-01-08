import fs from "node:fs";
import type { WeatherData, WeatherError } from "@/lib/types";
import {
  ServiceError,
  readResponseBody,
  requireEnv,
  toServiceError,
} from "@/lib/services/errors";
import type { WeatherOptions, WeatherService } from "@/lib/services/weather/types";

type TlsState = {
  mode: "default" | "custom_ca" | "insecure";
  caPath?: string;
  caError?: { name: string; message: string };
};

let tlsState: TlsState | null = null;

const DEFAULT_TIMEOUT_MS = 8000;

const resolveTimeoutMs = () => {
  const raw = process.env.OPENWEATHER_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

const resolveTlsState = (): TlsState => {
  if (tlsState) return tlsState;

  const isDev = process.env.NODE_ENV !== "production";
  const allowInsecure = process.env.ALLOW_INSECURE_SSL === "true";
  if (isDev && allowInsecure) {
    // WARNING: Dev-only fallback. Do NOT enable in production.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    tlsState = { mode: "insecure" };
    return tlsState;
  }

  const caPath = process.env.NODE_EXTRA_CA_CERTS;
  if (caPath) {
    try {
      fs.readFileSync(caPath);
      tlsState = { mode: "custom_ca", caPath };
      return tlsState;
    } catch (error) {
      const err = error as { name?: string; message?: string };
      tlsState = {
        mode: "default",
        caPath,
        caError: {
          name: err.name ?? "Error",
          message: err.message ?? "Failed to read CA file",
        },
      };
      return tlsState;
    }
  }

  tlsState = { mode: "default" };
  return tlsState;
};

const toWeatherError = (error: unknown): WeatherError => {
  const serviceError = toServiceError(error);
  return {
    message: serviceError.message || "Weather provider error",
    code: serviceError.code,
    status: serviceError.status,
  };
};

const fetchWithTimeout = async (url: URL, label: string) => {
  const timeoutMs = resolveTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const tlsInfo = resolveTlsState();

  try {
    return await fetch(url.toString(), { signal: controller.signal });
  } catch (error) {
    const err = error as {
      name?: string;
      message?: string;
      code?: string;
      cause?: { code?: string };
    };
    const isTimeout = err.name === "AbortError";
    const code = err.code ?? (isTimeout ? "ETIMEDOUT" : undefined);
    throw new ServiceError(
      isTimeout
        ? `Weather provider request timed out (${label})`
        : `Weather provider request failed (${label})`,
      {
        status: 502,
        code: "provider_error",
        details: {
          name: err.name ?? "Error",
          message: err.message ?? "fetch failed",
          code,
          causeCode: err.cause?.code,
          tlsMode: tlsInfo.mode,
          caPath: tlsInfo.caPath,
          caError: tlsInfo.caError,
          target: `${url.origin}${url.pathname}`,
          timeoutMs,
        },
        cause: error,
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

const buildProviderError = async (response: Response, label: string) => {
  const body = await readResponseBody(response);
  const status = response.status;
  const target = response.url ? new URL(response.url).pathname : undefined;
  let message = `Weather provider error (${label})`;
  let code: ServiceError["code"] = "provider_error";

  if (status === 401 || status === 403) {
    message = `Weather provider rejected request (${label})`;
  } else if (status === 404) {
    message = `Weather provider endpoint not found (${label})`;
    code = "not_found";
  } else if (status === 429) {
    message = `Weather provider rate limit exceeded (${label})`;
    code = "rate_limited";
  }

  throw new ServiceError(message, {
    status,
    code,
    details: {
      status,
      label,
      target,
      body,
    },
  });
};

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

    const fetchCurrent = async () => {
      const response = await fetchWithTimeout(currentUrl, "current");
      if (!response.ok) {
        await buildProviderError(response, "current");
      }
      return (await response.json()) as {
        main: { temp: number; humidity: number };
        wind?: { speed?: number };
        weather?: { description: string; icon: string }[];
      };
    };

    const fetchForecast = async () => {
      const response = await fetchWithTimeout(forecastUrl, "forecast");
      if (!response.ok) {
        await buildProviderError(response, "forecast");
      }
      return (await response.json()) as {
        list: {
          dt: number;
          main: { temp_min: number; temp_max: number };
          weather?: { description: string; icon: string }[];
        }[];
      };
    };

    const [currentResult, forecastResult] = await Promise.allSettled([
      fetchCurrent(),
      fetchForecast(),
    ]);

    if (currentResult.status === "rejected") {
      throw currentResult.reason;
    }

    const current = currentResult.value;
    if (!Number.isFinite(current?.main?.temp)) {
      throw new ServiceError("Weather provider response missing temp", {
        status: 502,
        code: "provider_error",
      });
    }

    if (!Number.isFinite(current?.main?.humidity)) {
      throw new ServiceError("Weather provider response missing humidity", {
        status: 502,
        code: "provider_error",
      });
    }

    const errors: WeatherData["errors"] = {};
    let forecast = forecastResult.status === "fulfilled" ? forecastResult.value : null;

    if (forecastResult.status === "rejected") {
      errors.forecast = toWeatherError(forecastResult.reason);
    }

    if (forecast && !Array.isArray(forecast.list)) {
      errors.forecast = toWeatherError(
        new ServiceError("Weather forecast response missing list", {
          status: 502,
          code: "provider_error",
        })
      );
      forecast = null;
    }

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

    for (const item of forecast?.list ?? []) {
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
    while (dailyAgg.length < 7 && dailyAgg.length > 0) {
      const last = dailyAgg[dailyAgg.length - 1];
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

    const daily = dailyAgg.map((day) => ({
      date: new Date(day.reprDt * 1000).toISOString(),
      minC: day.min,
      maxC: day.max,
      description: day.reprDesc ?? "",
      icon: day.reprIcon ?? "01d",
    }));

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
      daily,
      errors: Object.keys(errors).length ? errors : undefined,
    };
  }
}

export const getWeather = (
  lat: number,
  lon: number,
  options?: WeatherOptions
) => new OpenWeatherService().getWeather(lat, lon, options);
