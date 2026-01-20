import type { Country } from "@/lib/types";
import { countryMeta, getCapitalCoordinates } from "@/lib/countries/countryMeta";

export type FeaturedCityProps = {
  id: string;
  name: string;
  countryCode: string;
  isCapital: boolean;
  groupRank: number;
  rank: number;
};

const COORD_EPSILON = 0.0001;

const isValidLatLon = (lat?: number, lon?: number) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat as number) > 90 || Math.abs(lon as number) > 180) {
    return false;
  }
  return true;
};

const isZeroCenter = (lat: number, lon: number) =>
  Math.abs(lat) < COORD_EPSILON && Math.abs(lon) < COORD_EPSILON;

const slug = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "city";
};

const buildId = (country: Country, name: string) =>
  `${country.code}-${slug(name)}`;

export function buildFeaturedCitiesGeoJson(): GeoJSON.FeatureCollection<
  GeoJSON.Point,
  FeaturedCityProps
> {
  const features: GeoJSON.Feature<GeoJSON.Point, FeaturedCityProps>[] = [];
  const seen = new Set<string>();

  countryMeta.forEach((country) => {
    const countryCode = country.code.toUpperCase();
    const addFeature = (
      name: string,
      lat: number,
      lon: number,
      isCapital: boolean,
      groupRank: number
    ) => {
      if (!isValidLatLon(lat, lon) || isZeroCenter(lat, lon)) return;
      const dedupeKey = `${countryCode}-${name.trim().toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lon, lat],
        },
        properties: {
          id: buildId(country, name),
          name,
          countryCode,
          isCapital,
          groupRank,
          rank: isCapital ? 0 : 10 + groupRank,
        },
      });
      seen.add(dedupeKey);
    };

    const capitalCoords = getCapitalCoordinates(country);
    if (capitalCoords && country.capital) {
      addFeature(
        country.capital,
        capitalCoords.lat,
        capitalCoords.lon,
        true,
        0
      );
    }

    (country.topCities ?? []).forEach((city, index) => {
      addFeature(city.name, city.lat, city.lon, false, index + 1);
    });
  });

  return { type: "FeatureCollection", features };
}
