export type Bbox = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};

export type LatLon = { lat: number; lon: number };

export const normalizeCountryCode = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

export const normalizeCityId = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

export const haversineDistanceKm = (from: LatLon, to: LatLon) => {
  const earthRadius = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

export const isWithinBbox = (center: LatLon, bbox: Bbox) =>
  center.lat >= bbox.minLat &&
  center.lat <= bbox.maxLat &&
  center.lon >= bbox.minLon &&
  center.lon <= bbox.maxLon;
