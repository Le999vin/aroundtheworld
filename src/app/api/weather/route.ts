import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { logServiceError, toErrorResponse } from "@/lib/services/errors";
import { getWeatherService } from "@/lib/services/weather";
import type { WeatherUnits } from "@/lib/services/weather/types";

const parseUnits = (value?: string): WeatherUnits =>
  value === "imperial" ? "imperial" : "metric";

const roundCoordinate = (value: number) => Math.round(value * 10000) / 10000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Invalid or missing lat/lon", code: "bad_request" },
      { status: 400 }
    );
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
    return NextResponse.json(data);
  } catch (error) {
    const { serviceError, status, body } = toErrorResponse(error);
    logServiceError("api/weather", serviceError);
    return NextResponse.json(
      body,
      { status }
    );
  }
}
