import { NextRequest, NextResponse } from "next/server";
import { getPoisForMap } from "@/lib/data/pois";
import { PLACE_CATEGORIES } from "@/lib/data/pois/schema";
import { logServiceError, toErrorResponse } from "@/lib/services/errors";
import type { PlaceCategory } from "@/lib/types";

const parseNumber = (value: string | null) => {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function GET(request: NextRequest) {
  // Deprecated alias for /api/pois. External providers are disabled.
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") ?? undefined;
  const city = searchParams.get("city") ?? undefined;
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const limitParam = searchParams.get("limit");
  const categoryParam = searchParams.get("category");

  const lat = parseNumber(latParam);
  const lon = parseNumber(lonParam);

  if ((latParam || lonParam) && (lat === undefined || lon === undefined)) {
    return NextResponse.json(
      { error: "Invalid or missing lat/lon", code: "bad_request" },
      { status: 400 }
    );
  }

  if (!country && !city && lat === undefined && lon === undefined) {
    return NextResponse.json(
      { error: "Missing selector (country, city, or lat/lon)", code: "bad_request" },
      { status: 400 }
    );
  }

  let category: PlaceCategory | "all" | undefined;
  if (categoryParam) {
    if (categoryParam === "all") {
      category = "all";
    } else if (PLACE_CATEGORIES.includes(categoryParam as PlaceCategory)) {
      category = categoryParam as PlaceCategory;
    } else {
      return NextResponse.json(
        { error: "Invalid category", code: "bad_request" },
        { status: 400 }
      );
    }
  }

  const limit = parseNumber(limitParam);
  if (limitParam && limit === undefined) {
    return NextResponse.json(
      { error: "Invalid limit", code: "bad_request" },
      { status: 400 }
    );
  }

  try {
    const pois = await getPoisForMap({
      country,
      city,
      lat,
      lon,
      limit,
      category,
    });
    return NextResponse.json(pois);
  } catch (error) {
    const { serviceError, status, body } = toErrorResponse(error);
    logServiceError("api/places", serviceError);
    return NextResponse.json(body, { status });
  }
}
