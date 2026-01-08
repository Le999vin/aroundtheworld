import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  ServiceError,
  type ServiceErrorCode,
  logServiceError,
  toServiceError,
} from "@/lib/services/errors";
import { getWeatherService } from "@/lib/services/weather";
import type { WeatherUnits } from "@/lib/services/weather/types";
import type { WeatherData } from "@/lib/types";

const parseUnits = (value?: string): WeatherUnits =>
  value === "imperial" ? "imperial" : "metric";

const roundCoordinate = (value: number) => Math.round(value * 10000) / 10000;

const isValidLatLon = (lat: number, lon: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;

const isZeroCenter = (lat: number, lon: number) =>
  Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001;

type WeatherErrorBody = {
  error: string;
  message: string;
  code: ServiceErrorCode;
  upstreamHint: string | null;
  debugId: string;
};

const weatherFallbackCache = new Map<string, WeatherData>();
const weatherFailureLog = new Map<string, number>();
const FAILURE_LOG_COOLDOWN_MS = 5 * 60 * 1000;

const findErrorCode = (details: unknown) => {
  if (!details || typeof details !== "object") return undefined;
  const record = details as Record<string, unknown>;
  const code = record.code ?? record.causeCode;
  return typeof code === "string" ? code : undefined;
};

const getUpstreamHint = (serviceError: ServiceError): string | null => {
  if (serviceError.code === "missing_env") return "missing_api_key";
  if (serviceError.code === "bad_request") return "invalid_location";
  if (serviceError.code === "rate_limited") return "rate_limited";
  if (serviceError.code !== "provider_error") return null;

  const code = findErrorCode(serviceError.details);
  if (
    code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN"
  ) {
    return "ssl_error";
  }
  if (
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT"
  ) {
    return "network_error";
  }
  return "upstream_error";
};

const getFriendlyMessage = (serviceError: ServiceError) => {
  switch (serviceError.code) {
    case "bad_request":
      return "Invalid or missing lat/lon";
    case "missing_env":
      return "Weather API key is not configured";
    case "rate_limited":
      return "Weather provider rate limit exceeded";
    case "not_found":
      return "Weather provider endpoint was not found";
    case "provider_error":
      if (serviceError.status === 401 || serviceError.status === 403) {
        return "Weather provider rejected the API key";
      }
      return "Weather service is temporarily unavailable";
    default:
      return "Weather service is temporarily unavailable";
  }
};

const mapStatus = (serviceError: ServiceError) => {
  if (serviceError.status >= 400 && serviceError.status <= 599) {
    return serviceError.status;
  }
  return 500;
};

const buildWeatherErrorBody = (
  serviceError: ServiceError,
  debugId: string
): WeatherErrorBody => {
  const message = getFriendlyMessage(serviceError);
  return {
    error: message,
    message,
    code: serviceError.code,
    upstreamHint: getUpstreamHint(serviceError),
    debugId,
  };
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const lat = latParam === null ? Number.NaN : Number(latParam);
  const lon = lonParam === null ? Number.NaN : Number(lonParam);

  if (!isValidLatLon(lat, lon)) {
    const debugId = randomUUID();
    const serviceError = new ServiceError("Invalid or missing lat/lon", {
      status: 400,
      code: "bad_request",
    });
    const body = buildWeatherErrorBody(serviceError, debugId);
    return NextResponse.json(
      body,
      { status: 400 }
    );
  }

  const allowZero =
    searchParams.get("allowZero") === "1" ||
    searchParams.get("allowZero") === "true";
  if (!allowZero && isZeroCenter(lat, lon)) {
    const debugId = randomUUID();
    const serviceError = new ServiceError("Invalid or missing lat/lon", {
      status: 400,
      code: "bad_request",
      details: { reason: "zero_center" },
    });
    const body = buildWeatherErrorBody(serviceError, debugId);
    return NextResponse.json(body, { status: 400 });
  }

  const units = parseUnits(process.env.NEXT_PUBLIC_DEFAULT_UNITS);
  const lang = process.env.NEXT_PUBLIC_DEFAULT_LANG ?? "de";
  const service = getWeatherService();
  const roundedLat = roundCoordinate(lat);
  const roundedLon = roundCoordinate(lon);
  const cacheKey = `weather:${service.provider}:${roundedLat.toFixed(4)}:${roundedLon.toFixed(4)}:${units}:${lang}`;
  const cached = unstable_cache(
    () => service.getWeather(roundedLat, roundedLon, { units, lang }),
    [cacheKey],
    { revalidate: 600 }
  );

  try {
    const data = await cached();
    weatherFallbackCache.set(cacheKey, data);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[api/weather] response", {
        lat: data.location?.lat ?? roundedLat,
        lon: data.location?.lon ?? roundedLon,
        tempC: data.current?.tempC,
        hasForecastError: Boolean(data.errors?.forecast),
      });
    }
    return NextResponse.json(data);
  } catch (error) {
    const serviceError = toServiceError(error);
    const debugId = randomUUID();
    const fallback = weatherFallbackCache.get(cacheKey);
    if (fallback) {
      const now = Date.now();
      const lastLog = weatherFailureLog.get(cacheKey) ?? 0;
      if (now - lastLog > FAILURE_LOG_COOLDOWN_MS) {
        console.warn("[api/weather] using stale cache", {
          debugId,
          code: serviceError.code,
          hint: getUpstreamHint(serviceError),
        });
        weatherFailureLog.set(cacheKey, now);
      }
      return NextResponse.json(fallback);
    }

    logServiceError("api/weather", serviceError);
    if (serviceError.details) {
      console.error("[api/weather] details", {
        debugId,
        details: serviceError.details,
      });
    }
    const body = buildWeatherErrorBody(serviceError, debugId);
    const status = mapStatus(serviceError);
    return NextResponse.json(body, { status });
  }
}
