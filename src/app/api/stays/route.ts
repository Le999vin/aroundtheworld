import { NextRequest, NextResponse } from "next/server";
import { logServiceError, toServiceError } from "@/lib/services/errors";
import type { Bbox, Stay } from "@/lib/stays/types";
import { fetchMockStays } from "@/lib/stays/providers/mock";
import { getStaysProvider } from "@/lib/stays/providers";

type StaysMeta = {
  source: "mock" | "partner";
  fallback?: "mock";
  error?: string;
};

type StaysResponse = {
  stays: Stay[];
  meta: StaysMeta;
};

const CACHE_TTL_MS = 60_000;
const MAX_LIMIT = 300;

const responseCache = new Map<string, { expiresAt: number; data: StaysResponse }>();

const parseNumber = (value: string | null) => {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBbox = (value: string | null): Bbox | null => {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (
    Math.abs(minLat) > 90 ||
    Math.abs(maxLat) > 90 ||
    Math.abs(minLon) > 180 ||
    Math.abs(maxLon) > 180
  ) {
    return null;
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    return null;
  }
  return { minLon, minLat, maxLon, maxLat };
};

const roundCoord = (value: number) => Math.round(value * 10_000) / 10_000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bbox = parseBbox(searchParams.get("bbox"));
  if (!bbox) {
    return NextResponse.json(
      { error: "Invalid bbox", code: "bad_request" },
      { status: 400 }
    );
  }

  const minPrice = parseNumber(searchParams.get("minPrice"));
  const maxPrice = parseNumber(searchParams.get("maxPrice"));
  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    minPrice > maxPrice
  ) {
    return NextResponse.json(
      { error: "Invalid price range", code: "bad_request" },
      { status: 400 }
    );
  }

  const currency = searchParams.get("currency")?.trim() || "EUR";
  const countryParam = searchParams.get("country")?.trim().toUpperCase();
  const country =
    countryParam && /^[A-Z]{2}$/.test(countryParam) ? countryParam : undefined;
  if (countryParam && !country) {
    return NextResponse.json(
      { error: "Invalid country", code: "bad_request" },
      { status: 400 }
    );
  }
  const limitParam = parseNumber(searchParams.get("limit"));
  const limit = Math.min(
    Math.max(1, Math.floor(limitParam ?? 200)),
    MAX_LIMIT
  );

  const providerName = (process.env.STAYS_PROVIDER ?? "mock").toLowerCase();
  const key = [
    providerName,
    country ?? "",
    roundCoord(bbox.minLon),
    roundCoord(bbox.minLat),
    roundCoord(bbox.maxLon),
    roundCoord(bbox.maxLat),
    minPrice ?? "",
    maxPrice ?? "",
    currency,
    limit,
  ].join("|");

  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const requestParams = { bbox, minPrice, maxPrice, currency, limit, country };
  let stays: Stay[] = [];
  let meta: StaysMeta = {
    source: providerName === "partner" ? "partner" : "mock",
  };

  try {
    const provider = getStaysProvider(providerName);
    stays = await provider.search(requestParams);
    meta.source = provider.name;
  } catch (error) {
    const serviceError = toServiceError(error);
    logServiceError("api/stays", serviceError);
    meta.error = serviceError.message || "Failed to load stays";

    if (providerName === "partner") {
      try {
        stays = await fetchMockStays(requestParams);
        meta = {
          source: "mock",
          fallback: "mock",
          error: meta.error,
        };
      } catch (fallbackError) {
        const fallbackServiceError = toServiceError(fallbackError);
        logServiceError("api/stays:mock-fallback", fallbackServiceError);
        meta = {
          source: "mock",
          fallback: "mock",
          error: meta.error,
        };
        stays = [];
      }
    } else {
      stays = [];
    }
  }

  const data: StaysResponse = { stays, meta };
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(data);
}
