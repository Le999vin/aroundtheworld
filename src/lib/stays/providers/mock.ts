import fs from "node:fs/promises";
import path from "node:path";
import { ServiceError } from "@/lib/services/errors";
import type { Bbox, Stay } from "@/lib/stays/types";

type StaySearchParams = {
  bbox: Bbox;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  country?: string;
  limit?: number;
};

const COUNTRY_DIR = path.join(
  process.cwd(),
  "public",
  "data",
  "stays",
  "countries"
);
const ALL_PATH = path.join(process.cwd(), "public", "data", "stays.all.json");
const LEGACY_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "stays.mock.json"
);

const countryCache = new Map<string, Stay[] | Promise<Stay[]>>();
const missingCountries = new Set<string>();
let allCache: Stay[] | null = null;
let allCachePromise: Promise<Stay[]> | null = null;

const normalizeCountryCode = (value: unknown) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : "";
};

const normalizeStay = (entry: unknown): Stay | null => {
  if (!entry || typeof entry !== "object") return null;
  const candidate = entry as Record<string, unknown>;
  const id =
    typeof candidate.id === "string"
      ? candidate.id
      : typeof candidate.id === "number"
        ? candidate.id.toString()
        : "";
  const title = typeof candidate.title === "string" ? candidate.title : "";
  const lat = typeof candidate.lat === "number" ? candidate.lat : NaN;
  const lon = typeof candidate.lon === "number" ? candidate.lon : NaN;
  const price =
    typeof candidate.price === "number" ? candidate.price : Number.NaN;
  const currency =
    typeof candidate.currency === "string" && candidate.currency.trim()
      ? candidate.currency.trim().toUpperCase()
      : "EUR";
  const countryCode = normalizeCountryCode(
    candidate.countryCode ?? candidate.country
  );
  if (!id || !title || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (!Number.isFinite(price) || !countryCode) return null;
  const url = typeof candidate.url === "string" ? candidate.url : "";
  const source = candidate.source === "partner" ? "partner" : "mock";
  return {
    id,
    title,
    lat,
    lon,
    price,
    currency,
    countryCode,
    imageUrl:
      typeof candidate.imageUrl === "string" ? candidate.imageUrl : undefined,
    rating: typeof candidate.rating === "number" ? candidate.rating : undefined,
    url,
    source,
  };
};

const isValidStay = (entry: Stay) =>
  Boolean(
    entry &&
      typeof entry.id === "string" &&
      typeof entry.title === "string" &&
      typeof entry.lat === "number" &&
      typeof entry.lon === "number" &&
      typeof entry.price === "number" &&
      typeof entry.currency === "string" &&
      typeof entry.countryCode === "string" &&
      typeof entry.url === "string" &&
      (entry.source === "mock" || entry.source === "partner")
  );

const readStayFile = async (filePath: string, context: string) => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new ServiceError(`Invalid stays dataset: ${context}`, {
        status: 500,
        code: "unexpected",
      });
    }
    return parsed
      .map((entry) => normalizeStay(entry))
      .filter((entry): entry is Stay => Boolean(entry) && isValidStay(entry));
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(`Failed to load stays dataset: ${context}`, {
      status: 500,
      code: "unexpected",
      cause: error,
    });
  }
};

const loadCountryStays = async (country: string) => {
  const cached = countryCache.get(country);
  if (cached) {
    return cached instanceof Promise ? cached : cached;
  }
  const promise = (async () => {
    const filePath = path.join(COUNTRY_DIR, `${country}.json`);
    const stays = await readStayFile(filePath, `country:${country}`);
    if (!stays && !missingCountries.has(country)) {
      console.warn(`[stays] Missing dataset for ${country}.`);
      missingCountries.add(country);
    }
    return stays ?? [];
  })();
  countryCache.set(country, promise);
  const resolved = await promise;
  countryCache.set(country, resolved);
  return resolved;
};

const loadAllStays = async () => {
  if (allCache) return allCache;
  if (allCachePromise) return allCachePromise;
  allCachePromise = (async () => {
    const all = await readStayFile(ALL_PATH, "all");
    if (all) return all;
    const legacy = await readStayFile(LEGACY_PATH, "legacy");
    return legacy ?? [];
  })();
  allCache = await allCachePromise;
  allCachePromise = null;
  return allCache;
};

const isWithinBbox = (stay: Stay, bbox: Bbox) =>
  stay.lat >= bbox.minLat &&
  stay.lat <= bbox.maxLat &&
  stay.lon >= bbox.minLon &&
  stay.lon <= bbox.maxLon;

const matchesPrice = (stay: Stay, minPrice?: number, maxPrice?: number) => {
  if (Number.isFinite(minPrice) && stay.price < (minPrice as number)) {
    return false;
  }
  if (Number.isFinite(maxPrice) && stay.price > (maxPrice as number)) {
    return false;
  }
  return true;
};

export const fetchMockStays = async ({
  bbox,
  minPrice,
  maxPrice,
  currency,
  country,
  limit = 200,
}: StaySearchParams): Promise<Stay[]> => {
  const normalizedCountry = normalizeCountryCode(country);
  const stays = normalizedCountry
    ? await loadCountryStays(normalizedCountry)
    : await loadAllStays();
  const normalizedCurrency =
    typeof currency === "string" && currency.trim()
      ? currency.trim().toUpperCase()
      : undefined;
  const filtered = stays.filter((stay) => {
    if (normalizedCountry && stay.countryCode !== normalizedCountry) {
      return false;
    }
    if (!isWithinBbox(stay, bbox)) return false;
    if (normalizedCurrency && stay.currency !== normalizedCurrency) return false;
    return matchesPrice(stay, minPrice, maxPrice);
  });
  const cappedLimit = Math.min(Math.max(1, Math.floor(limit ?? 200)), 300);
  return filtered.slice(0, cappedLimit);
};
