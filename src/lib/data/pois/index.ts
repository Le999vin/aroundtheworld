import { ServiceError } from "@/lib/services/errors";
import type { POI, PlaceCategory } from "@/lib/types";
import { parsePoisDataset } from "@/lib/data/pois/schema";
import { resolveCountryCode } from "@/lib/countries/countryMeta";
import {
  cityDatasets,
  countryDatasets,
  type CityDataset,
} from "@/lib/data/pois/registry";
import {
  haversineDistanceKm,
  isWithinBbox,
  normalizeCityId,
  normalizeCountryCode,
  type LatLon,
} from "@/lib/data/pois/utils";

export type { PlaceCategory } from "@/lib/types";
export {
  haversineDistanceKm,
  normalizeCityId,
  normalizeCountryCode,
} from "@/lib/data/pois/utils";

type GetPoisParams = {
  country?: string;
  city?: string;
  lat?: number;
  lon?: number;
  limit?: number;
  category?: PlaceCategory | "all";
};

type StaticPoisOptions = {
  category?: PlaceCategory | "all";
  limit?: number;
};

const ensureLimit = (limit?: number) => {
  if (limit === undefined) return 12;
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new ServiceError("Invalid limit", {
      status: 400,
      code: "bad_request",
    });
  }
  return Math.floor(limit);
};

const loadDataset = async (loader: () => Promise<unknown>, context: string) => {
  try {
    const raw = await loader();
    const { pois, meta } = parsePoisDataset(raw, context);
    if (meta.invalidCount > 0) {
      console.warn(
        `[pois] Filtered ${meta.invalidCount} invalid POIs from ${context}.`
      );
    }
    return pois;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(`Failed to load POI dataset ${context}`, {
      status: 500,
      code: "unexpected",
      cause: error,
    });
  }
};

const loadGlobal = async () =>
  loadDataset(
    async () => (await import("./datasets/global.sample.json")).default,
    "global"
  );

const selectCityDatasetForCenter = (center: LatLon): CityDataset | null => {
  const cityList = Object.values(cityDatasets);
  return cityList.find(
    (dataset) => dataset.bbox && isWithinBbox(center, dataset.bbox)
  ) ?? null;
};

const applyFilters = (
  pois: POI[],
  center: LatLon | null,
  category: PlaceCategory | "all" | undefined,
  limit: number,
  selector?: { countryCode?: string; cityId?: string }
) => {
  const scoped = selector
    ? pois.filter((poi) => {
        if (selector.countryCode && poi.countryCode !== selector.countryCode) {
          return false;
        }
        if (selector.cityId && poi.cityId !== selector.cityId) {
          return false;
        }
        return true;
      })
    : pois;

  const filtered =
    category && category !== "all"
      ? scoped.filter((poi) => poi.category === category)
      : scoped;

  const sorted = center
    ? filtered
        .map((poi) => ({
          poi,
          distance: haversineDistanceKm(center, { lat: poi.lat, lon: poi.lon }),
        }))
        .sort((a, b) => a.distance - b.distance)
        .map(({ poi }) => poi)
    : filtered;

  return sorted.slice(0, limit);
};

export const getPoisForMap = async (
  params: GetPoisParams
): Promise<POI[]> => {
  const limit = ensureLimit(params.limit);
  const category = params.category;
  const center =
    Number.isFinite(params.lat) && Number.isFinite(params.lon)
      ? { lat: params.lat as number, lon: params.lon as number }
      : null;

  if (params.city) {
    const cityId = normalizeCityId(params.city);
    if (!cityId) {
      throw new ServiceError("Invalid city parameter", {
        status: 400,
        code: "bad_request",
      });
    }
    const dataset = cityDatasets[cityId];
    if (!dataset) {
      const globalPois = await loadGlobal();
      return applyFilters(globalPois, center, category, limit, { cityId });
    }
    const pois = await loadDataset(dataset.loader, `city:${cityId}`);
    return applyFilters(pois, center ?? dataset.center, category, limit, {
      cityId,
    });
  }

  if (params.country) {
    const normalized = normalizeCountryCode(params.country);
    const countryCode = normalized ? resolveCountryCode(normalized) : null;
    if (!countryCode) {
      throw new ServiceError("Invalid country parameter", {
        status: 400,
        code: "bad_request",
      });
    }
    const loader = countryDatasets[countryCode];
    if (!loader) {
      const globalPois = await loadGlobal();
      return applyFilters(globalPois, center, category, limit, { countryCode });
    }
    const pois = await loadDataset(loader, `country:${countryCode}`);
    return applyFilters(pois, center, category, limit, { countryCode });
  }

  if (!center) {
    throw new ServiceError("Missing location or dataset selector", {
      status: 400,
      code: "bad_request",
    });
  }

  const cityDataset = selectCityDatasetForCenter(center);
  if (!cityDataset) {
    const globalPois = await loadGlobal();
    return applyFilters(globalPois, center, category, limit);
  }
  const pois = await loadDataset(cityDataset.loader, `city:${cityDataset.id}`);
  return applyFilters(pois, center, category, limit, {
    cityId: cityDataset.id,
  });
};

export const getStaticPoisForCenter = async (
  center: LatLon,
  opts: StaticPoisOptions = {}
): Promise<POI[]> =>
  getPoisForMap({
    lat: center.lat,
    lon: center.lon,
    category: opts.category,
    limit: opts.limit,
  });

export const getPois = getPoisForMap;
