import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getGeocodingService } from "@/lib/services/geocoding";
import { toServiceError } from "@/lib/services/errors";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const service = getGeocodingService();
  const cached = unstable_cache(
    () => service.geocode(query),
    [`geocode:${service.provider}:${query}`],
    { revalidate: 60 * 60 * 24 * 7 }
  );

  try {
    const data = await cached();
    return NextResponse.json(data);
  } catch (error) {
    const serviceError = toServiceError(error);
    return NextResponse.json(
      { error: serviceError.message },
      { status: serviceError.status }
    );
  }
}
