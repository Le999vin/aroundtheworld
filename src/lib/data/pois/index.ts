import type { POI } from "@/lib/types";
import {
  parseStaticPois,
  type PlaceCategory,
  type StaticPOI,
} from "@/lib/data/pois/schema";
import { fallbackRegion, findRegionForCenter } from "@/lib/data/pois/regions";

type Center = { lat: number; lon: number };

type StaticPoisOptions = {
  category?: PlaceCategory | "all";
  limit?: number;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceKm = (from: Center, to: Center) => {
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

const loadRegionPois = async (
  regionId: string,
  loader: () => Promise<StaticPOI[]>
) => {
  try {
    const raw = await loader();
    const parsed = parseStaticPois(raw, regionId);
    if (parsed.length) return parsed;
    console.warn(
      `[static-pois] Dataset ${regionId} returned no valid items. Falling back to global.sample.`
    );
  } catch (error) {
    console.warn(`[static-pois] Failed to load dataset ${regionId}.`, error);
  }
  return [];
};

export const getStaticPoisForCenter = async (
  center: Center,
  opts: StaticPoisOptions = {}
): Promise<POI[]> => {
  const region = findRegionForCenter(center);
  let pois = await loadRegionPois(region.id, region.dataset);

  if (!pois.length && region.id !== fallbackRegion.id) {
    pois = await loadRegionPois(fallbackRegion.id, fallbackRegion.dataset);
  }

  const filtered =
    opts.category && opts.category !== "all"
      ? pois.filter((poi) => poi.category === opts.category)
      : pois;

  const sorted = filtered
    .map((poi) => ({
      poi,
      distance: distanceKm(center, { lat: poi.lat, lon: poi.lon }),
    }))
    .sort((a, b) => a.distance - b.distance)
    .map(({ poi }) => poi);

  const limit = opts.limit ?? 12;
  return sorted.slice(0, limit);
};
