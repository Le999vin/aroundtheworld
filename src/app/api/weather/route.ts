import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { toServiceError } from "@/lib/services/errors";
import { getWeather } from "@/lib/services/weather/openweather";
import type { WeatherUnits } from "@/lib/services/weather/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Invalid or missing lat/lon" },
      { status: 400 }
    );
  }

  const units = (process.env.NEXT_PUBLIC_DEFAULT_UNITS ?? "metric") as WeatherUnits;
  const lang = process.env.NEXT_PUBLIC_DEFAULT_LANG ?? "de";
  const cached = unstable_cache(
    () => getWeather(lat, lon, { units, lang }),
    [`weather:openweather:${lat}:${lon}:${units}:${lang}`],
    { revalidate: 600 }
  );

  try {
    const data = await cached();
    return NextResponse.json(data);
  } catch (error) {
    const serviceError = toServiceError(error);
    return NextResponse.json(
      { error: serviceError.message },
      { status: 500 }
    );
  }
}
