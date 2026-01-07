import { NextRequest, NextResponse } from "next/server";
import { getStaticPoisForCenter } from "@/lib/data/pois";
import type { PlaceCategory } from "@/lib/data/pois/schema";

const CATEGORIES: PlaceCategory[] = [
  "landmarks",
  "museums",
  "food",
  "nightlife",
  "nature",
  "other",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const limitParam = searchParams.get("limit");
  const categoryParam = searchParams.get("category") ?? "all";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Invalid or missing lat/lon" },
      { status: 400 }
    );
  }

  const limit = limitParam ? Number(limitParam) : undefined;
  if (limitParam && !Number.isFinite(limit)) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  if (categoryParam !== "all" && !CATEGORIES.includes(categoryParam as PlaceCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const pois = await getStaticPoisForCenter(
    { lat, lon },
    {
      category: categoryParam as PlaceCategory | "all",
      limit: limit ?? 12,
    }
  );

  return NextResponse.json(pois);
}
