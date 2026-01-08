import { NextRequest, NextResponse } from "next/server";
import { getPoisForMap } from "@/lib/data/pois";
import { PLACE_CATEGORIES } from "@/lib/data/pois/constants";
import {
  getCountryMeta,
  getCountryMetaByName,
  resolveCountryCenterFromMeta,
} from "@/lib/countries/countryMeta";
import { logServiceError, toErrorResponse } from "@/lib/services/errors";
import type { PlaceCategory } from "@/lib/types";

type PoisRequestOptions = {
  requireLatLon?: boolean;
  allowCountry?: boolean;
  allowCity?: boolean;
  defaultCategory?: PlaceCategory | "all";
  logContext?: string;
};

const parseNumber = (value: string | null) => {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeParam = (value: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const isValidLatLon = (lat: number, lon: number) =>
  Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

const parseCategory = (
  value: string | null,
  fallback?: PlaceCategory | "all"
) => {
  if (!value && fallback) return fallback;
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "all") return "all";
  if (PLACE_CATEGORIES.includes(normalized as PlaceCategory)) {
    return normalized as PlaceCategory;
  }
  return null;
};

export const handlePoisRequest = async (
  request: NextRequest,
  options: PoisRequestOptions = {}
) => {
  const { searchParams } = new URL(request.url);
  const allowCountry = options.allowCountry !== false;
  const allowCity = options.allowCity !== false;
  const country = allowCountry ? normalizeParam(searchParams.get("country")) : undefined;
  const city = allowCity ? normalizeParam(searchParams.get("city")) : undefined;
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const limitParam = searchParams.get("limit");
  const categoryParam = searchParams.get("category");

  const lat = parseNumber(latParam);
  const lon = parseNumber(lonParam);
  const hasLatLon = lat !== undefined && lon !== undefined;
  const fallbackCenter =
    !hasLatLon && country
      ? resolveCountryCenterFromMeta(
          getCountryMeta(country) ?? getCountryMetaByName(country)
        )
      : null;
  const resolvedLat = hasLatLon ? lat : fallbackCenter?.lat;
  const resolvedLon = hasLatLon ? lon : fallbackCenter?.lon;
  const hasResolvedLatLon =
    resolvedLat !== undefined && resolvedLon !== undefined;

  if ((latParam || lonParam) && !hasLatLon) {
    return NextResponse.json(
      { error: "Invalid or missing lat/lon", code: "bad_request" },
      { status: 400 }
    );
  }

  if (
    hasResolvedLatLon &&
    !isValidLatLon(resolvedLat as number, resolvedLon as number)
  ) {
    return NextResponse.json(
      { error: "Invalid or missing lat/lon", code: "bad_request" },
      { status: 400 }
    );
  }

  if (options.requireLatLon && !hasLatLon) {
    return NextResponse.json(
      { error: "Missing lat/lon", code: "bad_request" },
      { status: 400 }
    );
  }

  if (!options.requireLatLon && !country && !city && !hasResolvedLatLon) {
    return NextResponse.json(
      { error: "Missing selector (country, city, or lat/lon)", code: "bad_request" },
      { status: 400 }
    );
  }

  const category = parseCategory(categoryParam, options.defaultCategory);
  if (category === null) {
    return NextResponse.json(
      { error: "Invalid category", code: "bad_request" },
      { status: 400 }
    );
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
      lat: resolvedLat,
      lon: resolvedLon,
      limit,
      category: category ?? undefined,
    });
    return NextResponse.json(pois);
  } catch (error) {
    const { serviceError, status, body } = toErrorResponse(error);
    logServiceError(options.logContext ?? "api/pois", serviceError);
    return NextResponse.json(body, { status });
  }
};
