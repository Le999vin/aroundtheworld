import { NextRequest, NextResponse } from "next/server";
import type { PoiImage } from "@/lib/types";
import {
  ServiceError,
  logServiceError,
  toErrorResponse,
  toServiceError,
} from "@/lib/services/errors";

type OsmRef = { type: "N" | "W" | "R"; id: number };

type PoiDetailsResponse = {
  address?: string;
  city?: string;
  openingHours?: string;
  website?: string;
  osm?: OsmRef;
  images?: PoiImage[];
};

type NominatimResponse = {
  display_name?: string;
  osm_type?: string;
  osm_id?: number | string;
  address?: Record<string, string | undefined>;
  extratags?: Record<string, string | undefined>;
  namedetails?: Record<string, string | undefined>;
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string | undefined>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type WikidataResponse = {
  results?: {
    bindings?: Array<{
      image?: { value?: string };
    }>;
  };
};

type WikipediaSummaryResponse = {
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "GlobalTravelAtlas/1.0 (contact: https://example.com)";
const WIKIDATA_URL = "https://query.wikidata.org/sparql";
const IMAGE_REQUEST_TIMEOUT_MS = 2500;
const IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const wikidataImageCache = new Map<string, { url: string; expiresAt: number }>();
const wikipediaImageCache = new Map<string, { url: string; expiresAt: number }>();

const DEV_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const devCache = new Map<string, { data: PoiDetailsResponse; expiresAt: number }>();

const NOMINATIM_MIN_INTERVAL_MS = 1000;
let nominatimQueue: Promise<unknown> = Promise.resolve();
let lastNominatimAt = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number,
  label: string
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError(`${label} timed out`, {
        status: 504,
        code: "provider_error",
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const scheduleNominatim = async <T,>(task: () => Promise<T>): Promise<T> => {
  const run = nominatimQueue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (now - lastNominatimAt));
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastNominatimAt = Date.now();
    return task();
  });
  nominatimQueue = run.catch(() => undefined);
  return run;
};

const getCachedImage = (
  cache: Map<string, { url: string; expiresAt: number }>,
  key: string
) => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.url;
};

const setCachedImage = (
  cache: Map<string, { url: string; expiresAt: number }>,
  key: string,
  url: string
) => {
  cache.set(key, { url, expiresAt: Date.now() + IMAGE_CACHE_TTL_MS });
};

const parseNumber = (value: string | null) => {
  if (!value) return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const isValidLatLon = (lat: number, lon: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;

const roundCoordinate = (value: number) => Math.round(value * 10000) / 10000;

const normalizeName = (value?: string) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const normalizeWikidataId = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  return /^Q\d+$/.test(upper) ? upper : null;
};

const parseWikipediaTag = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex > 0) {
    const lang = trimmed.slice(0, colonIndex).trim();
    const title = trimmed.slice(colonIndex + 1).trim();
    if (!title) return null;
    return { lang: lang || "en", title };
  }
  return { lang: "en", title: trimmed };
};

const extractWikimediaFilename = (imageUrl: string) => {
  try {
    const url = new URL(imageUrl);
    const path = url.pathname;
    const specialIndex = path.indexOf("/Special:FilePath/");
    if (specialIndex !== -1) {
      return decodeURIComponent(path.slice(specialIndex + "/Special:FilePath/".length));
    }
    const fileIndex = path.indexOf("/File:");
    if (fileIndex !== -1) {
      return decodeURIComponent(path.slice(fileIndex + "/File:".length));
    }
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash !== -1 && lastSlash < path.length - 1) {
      return decodeURIComponent(path.slice(lastSlash + 1));
    }
  } catch {
    return null;
  }
  return null;
};

const buildWikimediaImageUrl = (imageUrl: string) => {
  const filename = extractWikimediaFilename(imageUrl);
  if (!filename) return imageUrl;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    filename
  )}?width=1200`;
};

const levenshtein = (a: string, b: string) => {
  const aLen = a.length;
  const bLen = b.length;
  if (!aLen) return bLen;
  if (!bLen) return aLen;
  const matrix = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1).fill(0));
  for (let i = 0; i <= aLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[aLen][bLen];
};

const mapOsmType = (value?: string): OsmRef["type"] | null => {
  if (!value) return null;
  switch (value.toLowerCase()) {
    case "node":
    case "n":
      return "N";
    case "way":
    case "w":
      return "W";
    case "relation":
    case "r":
      return "R";
    default:
      return null;
  }
};

const buildAddress = (data: NominatimResponse) => {
  const address = data.address ?? {};
  const road =
    address.road ??
    address.pedestrian ??
    address.footway ??
    address.cycleway ??
    address.path ??
    address.square ??
    address.place ??
    address.suburb ??
    address.neighbourhood ??
    address.quarter ??
    address.hamlet ??
    address.village;

  if (road) {
    const houseNumber = address.house_number;
    return houseNumber ? `${houseNumber} ${road}` : road;
  }

  const display = data.display_name;
  if (display) {
    return display.split(",")[0]?.trim() ?? null;
  }

  return null;
};

const buildCity = (data: NominatimResponse) => {
  const address = data.address ?? {};
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    null
  );
};

const getWebsiteFromTags = (tags?: Record<string, string | undefined>) => {
  if (!tags) return undefined;
  return tags.website ?? tags["contact:website"];
};

const getOpeningHoursFromTags = (tags?: Record<string, string | undefined>) =>
  tags?.opening_hours;

const getElementName = (element: OverpassElement) => {
  const tags = element.tags ?? {};
  return tags.name ?? tags["name:en"] ?? tags["name:de"];
};

const elementToOsmRef = (element?: OverpassElement): OsmRef | null => {
  if (!element) return null;
  const type = mapOsmType(element.type);
  if (!type) return null;
  return { type, id: element.id };
};

const buildOverpassQueryById = (osm: OsmRef) => {
  const typeMap: Record<OsmRef["type"], string> = {
    N: "node",
    W: "way",
    R: "relation",
  };
  return [
    "[out:json][timeout:25];",
    `${typeMap[osm.type]}(${osm.id});`,
    "out tags center;",
  ].join("\n");
};

const buildOverpassAroundQuery = (lat: number, lon: number, category?: string) => {
  const around = `around:120,${lat},${lon}`;
  const base = `nwr(${around})["name"]`;
  const filters: string[] = [];

  switch (category) {
    case "nightlife":
      filters.push('["amenity"="nightclub"]', '["amenity"="bar"]');
      break;
    case "museums":
      filters.push('["tourism"="museum"]');
      break;
    case "landmarks":
      filters.push('["tourism"="attraction"]', '["historic"]');
      break;
    case "nature":
      filters.push('["natural"]', '["leisure"="park"]');
      break;
    default:
      break;
  }

  const statements =
    filters.length > 0
      ? filters.map((filter) => `${base}${filter};`).join("\n")
      : `${base};`;

  return [
    "[out:json][timeout:25];",
    "(",
    statements,
    ");",
    "out tags center 20;",
  ].join("\n");
};

const fetchOverpass = async (query: string): Promise<OverpassResponse> => {
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new ServiceError("Overpass request failed", {
      status: response.status,
      code: "provider_error",
    });
  }

  return (await response.json()) as OverpassResponse;
};

const fetchWikidataImage = async (wikidataId: string): Promise<string | null> => {
  const cached = getCachedImage(wikidataImageCache, wikidataId);
  if (cached) return cached;

  const query = `SELECT ?image WHERE { wd:${wikidataId} wdt:P18 ?image . } LIMIT 1`;
  const url = new URL(WIKIDATA_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", query);

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          "User-Agent": NOMINATIM_USER_AGENT,
          Accept: "application/sparql-results+json",
        },
      },
      IMAGE_REQUEST_TIMEOUT_MS,
      "Wikidata request"
    );

    if (!response.ok) {
      throw new ServiceError("Wikidata request failed", {
        status: response.status,
        code: "provider_error",
      });
    }

    const data = (await response.json()) as WikidataResponse;
    const imageUrl = data?.results?.bindings?.[0]?.image?.value;
    if (!imageUrl) return null;

    const resolved = buildWikimediaImageUrl(imageUrl);
    setCachedImage(wikidataImageCache, wikidataId, resolved);
    return resolved;
  } catch (error) {
    logServiceError("api/poi-details:wikidata", toServiceError(error));
    return null;
  }
};

const fetchWikipediaImage = async (
  lang: string,
  title: string
): Promise<string | null> => {
  const cacheKey = `${lang}:${title}`;
  const cached = getCachedImage(wikipediaImageCache, cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithTimeout(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {
        headers: {
          "User-Agent": NOMINATIM_USER_AGENT,
          Accept: "application/json",
        },
      },
      IMAGE_REQUEST_TIMEOUT_MS,
      "Wikipedia request"
    );

    if (!response.ok) {
      throw new ServiceError("Wikipedia request failed", {
        status: response.status,
        code: "provider_error",
      });
    }

    const data = (await response.json()) as WikipediaSummaryResponse;
    const imageUrl = data.thumbnail?.source ?? data.originalimage?.source;
    if (!imageUrl) return null;

    setCachedImage(wikipediaImageCache, cacheKey, imageUrl);
    return imageUrl;
  } catch (error) {
    logServiceError("api/poi-details:wikipedia", toServiceError(error));
    return null;
  }
};

const selectBestMatch = (elements: OverpassElement[], name?: string) => {
  if (!elements.length) return null;
  const target = normalizeName(name);
  if (!target) return elements[0];

  let best: OverpassElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const element of elements) {
    const candidateName = getElementName(element);
    if (!candidateName) continue;
    const normalized = normalizeName(candidateName);
    if (!normalized) continue;
    if (normalized === target) {
      return element;
    }
    const score = levenshtein(target, normalized);
    if (score < bestScore) {
      bestScore = score;
      best = element;
    }
  }

  return best ?? elements[0];
};

const fetchNominatim = async (lat: number, lon: number): Promise<NominatimResponse> => {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lon.toString());
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");

  return scheduleNominatim(async () => {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        "Accept-Language": "de",
      },
    });

    if (!response.ok) {
      throw new ServiceError("Nominatim request failed", {
        status: response.status,
        code: "provider_error",
      });
    }

    return (await response.json()) as NominatimResponse;
  });
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseNumber(searchParams.get("lat"));
  const lon = parseNumber(searchParams.get("lon"));
  const name = searchParams.get("name")?.trim() || undefined;
  const category = searchParams.get("category")?.trim() || undefined;

  if (!isValidLatLon(lat, lon)) {
    return NextResponse.json(
      { error: "Invalid or missing lat/lon", code: "bad_request" },
      { status: 400 }
    );
  }

  const roundedLat = roundCoordinate(lat);
  const roundedLon = roundCoordinate(lon);
  const cacheKey = `poi-details:${roundedLat}:${roundedLon}:${normalizeName(name)}:${category ?? "na"}`;

  if (process.env.NODE_ENV !== "production") {
    const cached = devCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    let nominatim: NominatimResponse | null = null;
    try {
      nominatim = await fetchNominatim(roundedLat, roundedLon);
    } catch (error) {
      logServiceError("api/poi-details:nominatim", error as ServiceError);
      nominatim = null;
    }

    const response: PoiDetailsResponse = {};
    const nominatimTags = nominatim?.extratags ?? {};

    if (nominatim) {
      const address = buildAddress(nominatim);
      const city = buildCity(nominatim);
      if (address) response.address = address;
      if (city) response.city = city;

      const osmType = mapOsmType(nominatim.osm_type);
      const osmId = Number(nominatim.osm_id);
      if (osmType && Number.isFinite(osmId)) {
        response.osm = { type: osmType, id: osmId };
      }

      const extraTags = nominatimTags;
      if (extraTags.opening_hours) response.openingHours = extraTags.opening_hours;
      const extraWebsite = getWebsiteFromTags(extraTags);
      if (extraWebsite) response.website = extraWebsite;
    }

    let matchedElement: OverpassElement | null = null;
    if (response.osm) {
      try {
        const data = await fetchOverpass(buildOverpassQueryById(response.osm));
        const element = data.elements?.[0];
        const elementName = element ? getElementName(element) : undefined;
        const normalizedPoi = normalizeName(name);
        const normalizedElement = normalizeName(elementName);
        if (element && normalizedPoi && normalizedElement && normalizedPoi === normalizedElement) {
          matchedElement = element;
        } else if (element && !normalizedPoi) {
          matchedElement = element;
        } else {
          matchedElement = null;
        }
      } catch (error) {
        logServiceError("api/poi-details:overpass-by-id", error as ServiceError);
      }
    }

    if (!matchedElement) {
      try {
        const data = await fetchOverpass(
          buildOverpassAroundQuery(roundedLat, roundedLon, category)
        );
        matchedElement = selectBestMatch(data.elements ?? [], name);
        const fallbackOsm = elementToOsmRef(matchedElement);
        if (fallbackOsm) {
          response.osm = fallbackOsm;
        }
      } catch (error) {
        logServiceError("api/poi-details:overpass-around", error as ServiceError);
      }
    }

    let wikidataTag: string | undefined;
    let wikipediaTag: string | undefined;

    if (matchedElement) {
      const tags = matchedElement.tags ?? {};
      const opening = getOpeningHoursFromTags(tags);
      if (opening && !response.openingHours) response.openingHours = opening;
      const site = getWebsiteFromTags(tags);
      if (site && !response.website) response.website = site;
      wikidataTag = tags.wikidata ?? tags["wikidata:entity"];
      wikipediaTag = tags.wikipedia;
    }

    if (!wikidataTag && nominatimTags.wikidata) {
      wikidataTag = nominatimTags.wikidata;
    }
    if (!wikipediaTag && nominatimTags.wikipedia) {
      wikipediaTag = nominatimTags.wikipedia;
    }

    const normalizedWikidataId = normalizeWikidataId(wikidataTag);
    const parsedWikipedia = parseWikipediaTag(wikipediaTag);

    if (normalizedWikidataId) {
      const imageUrl = await fetchWikidataImage(normalizedWikidataId);
      if (imageUrl) {
        response.images = [
          { url: imageUrl, source: "wikimedia", attribution: "Wikimedia Commons" },
        ];
      }
    }

    if (!response.images?.length && parsedWikipedia) {
      const imageUrl = await fetchWikipediaImage(
        parsedWikipedia.lang,
        parsedWikipedia.title
      );
      if (imageUrl) {
        response.images = [
          { url: imageUrl, source: "wikipedia", attribution: "Wikipedia" },
        ];
      }
    }

    if (process.env.NODE_ENV !== "production") {
      devCache.set(cacheKey, {
        data: response,
        expiresAt: Date.now() + DEV_CACHE_TTL_MS,
      });
    }

    const res = NextResponse.json(response);
    if (process.env.NODE_ENV === "production") {
      res.headers.set(
        "Cache-Control",
        "s-maxage=86400, stale-while-revalidate=604800"
      );
    }
    return res;
  } catch (error) {
    const { serviceError, status, body } = toErrorResponse(error);
    logServiceError("api/poi-details", serviceError);
    return NextResponse.json(body, { status });
  }
}
