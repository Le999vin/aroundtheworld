import { NextRequest, NextResponse } from "next/server";
import { getPoisForMap } from "@/lib/data/pois";
import { PLACE_CATEGORIES } from "@/lib/data/pois/schema";
import { logServiceError, toErrorResponse } from "@/lib/services/errors";
import type { PlaceCategory } from "@/lib/types";

export async function GET(request: NextRequest) {
  // Deprecated: use /api/pois with country/city/lat/lon selectors.
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const limitParam = searchParams.get("limit");
  const categoryParam = searchParams.get("category") ?? "all";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Invalid or missing lat/lon", code: "bad_request" },
      { status: 400 }
    );
  }

  const limit = limitParam ? Number(limitParam) : undefined;
  if (limitParam && !Number.isFinite(limit)) {
    return NextResponse.json(
      { error: "Invalid limit", code: "bad_request" },
      { status: 400 }
    );
  }

  if (
    categoryParam !== "all" &&
    !PLACE_CATEGORIES.includes(categoryParam as PlaceCategory)
  ) {
    return NextResponse.json(
      { error: "Invalid category", code: "bad_request" },
      { status: 400 }
    );
  }

  try {
    const pois = await getPoisForMap({
      lat,
      lon,
      category: categoryParam as PlaceCategory | "all",
      limit: limit ?? 12,
    });

    return NextResponse.json(pois);
  } catch (error) {
    const { serviceError, status, body } = toErrorResponse(error);
    logServiceError("api/static-places", serviceError);
    return NextResponse.json(body, { status });
  }
}
