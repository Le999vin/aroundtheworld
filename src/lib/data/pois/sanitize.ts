export type PoiSanitizeOptions = {
  defaultCountryCode?: string;
  defaultCityId?: string;
};

export type PoiSanitizeStats = {
  fixedCity: boolean;
  fixedAddress: boolean;
  fixedCountryCode: boolean;
  fixedCityId: boolean;
  fixedSource: boolean;
};

export type PoiSanitizeResult = {
  poi: Record<string, unknown> | null;
  stats: PoiSanitizeStats;
};

const trimString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const trimStringOrValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : value;

const normalizeCountryCode = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

const normalizeCityId = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
};

const titleCaseCityId = (value: string) =>
  value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const extractCityFromAddress = (value: string | undefined) => {
  if (!value) return undefined;
  const parts = value.split(",");
  if (parts.length < 2) return undefined;
  const candidate = parts[parts.length - 1].trim();
  if (!candidate) return undefined;
  if (!/[A-Za-z]/.test(candidate)) return undefined;
  return candidate;
};

const sanitizeImages = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const images = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const image = entry as Record<string, unknown>;
      const url = trimString(image.url);
      const source = trimString(image.source);
      if (!url || !source) return null;
      if (source !== "wikimedia" && source !== "wikipedia") return null;
      const attribution = trimString(image.attribution);
      return attribution ? { url, source, attribution } : { url, source };
    })
    .filter(Boolean);
  return images.length ? images : undefined;
};

const sanitizeTags = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .map((tag) => trimString(tag))
    .filter((tag): tag is string => Boolean(tag));
  return tags.length ? tags : undefined;
};

const sanitizeOsm = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const osm = value as Record<string, unknown>;
  const type = trimString(osm.type);
  const id = typeof osm.id === "number" ? osm.id : undefined;
  if (!type || !["N", "W", "R"].includes(type)) return undefined;
  if (!id || !Number.isInteger(id) || id <= 0) return undefined;
  return { type, id };
};

export const sanitizePoi = (
  raw: unknown,
  options: PoiSanitizeOptions = {}
): PoiSanitizeResult => {
  const stats: PoiSanitizeStats = {
    fixedCity: false,
    fixedAddress: false,
    fixedCountryCode: false,
    fixedCityId: false,
    fixedSource: false,
  };

  if (!raw || typeof raw !== "object") {
    return { poi: null, stats };
  }

  const input = raw as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  sanitized.id = trimStringOrValue(input.id);
  sanitized.name = trimStringOrValue(input.name);
  sanitized.category = trimStringOrValue(input.category);
  sanitized.lat = input.lat;
  sanitized.lon = input.lon;

  const sourceRaw = trimString(input.source);
  if (!sourceRaw || sourceRaw.toLowerCase() !== "static") {
    stats.fixedSource = true;
  }
  sanitized.source = "static";

  const countryRaw = trimString(input.countryCode);
  const normalizedCountry = normalizeCountryCode(
    countryRaw ?? options.defaultCountryCode ?? null
  );
  if (!countryRaw && normalizedCountry) {
    stats.fixedCountryCode = true;
  }
  if (normalizedCountry) {
    sanitized.countryCode = normalizedCountry;
  }

  const cityIdRaw = trimString(input.cityId);
  const normalizedCityId = normalizeCityId(
    cityIdRaw ?? options.defaultCityId ?? null
  );
  if (!cityIdRaw && normalizedCityId) {
    stats.fixedCityId = true;
  }
  if (normalizedCityId) {
    sanitized.cityId = normalizedCityId;
  }

  const nameRaw = trimString(input.name);
  const addressRaw = trimString(input.address);
  let city = trimString(input.city);
  if (!city) {
    const fromCityId = normalizedCityId
      ? titleCaseCityId(normalizedCityId)
      : undefined;
    const fromAddress = extractCityFromAddress(addressRaw);
    city = fromCityId ?? fromAddress ?? "Unknown";
    stats.fixedCity = true;
  }
  sanitized.city = city;

  let address = addressRaw;
  if (!address) {
    address = nameRaw && city ? `${nameRaw}, ${city}` : nameRaw ?? "Unknown Place";
    stats.fixedAddress = true;
  }
  sanitized.address = address;

  const googlePlaceId = trimString(input.googlePlaceId);
  if (googlePlaceId) sanitized.googlePlaceId = googlePlaceId;
  const description = trimString(input.description);
  if (description) sanitized.description = description;
  const website = trimString(input.website);
  if (website) sanitized.website = website;
  const mapsUrl = trimString(input.mapsUrl);
  if (mapsUrl) sanitized.mapsUrl = mapsUrl;
  const imageUrl = trimString(input.imageUrl);
  if (imageUrl) sanitized.imageUrl = imageUrl;
  const openingHours = trimString(input.openingHours);
  if (openingHours) sanitized.openingHours = openingHours;

  if (typeof input.rating === "number") {
    sanitized.rating = input.rating;
  }

  const images = sanitizeImages(input.images);
  if (images) sanitized.images = images;
  const tags = sanitizeTags(input.tags);
  if (tags) sanitized.tags = tags;
  const osm = sanitizeOsm(input.osm);
  if (osm) sanitized.osm = osm;

  return { poi: sanitized, stats };
};
