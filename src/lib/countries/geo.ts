import type { Feature, FeatureCollection, Geometry } from "geojson";
import { Vector3 } from "three";

export type CountryFeature = Feature<Geometry, Record<string, unknown>>;
export type CountriesGeoJson = FeatureCollection<
  Geometry,
  Record<string, unknown>
>;

export const getCountryCode = (feature: CountryFeature) => {
  const props = feature.properties ?? {};
  const code =
    (props.ISO_A2 as string | undefined) ||
    (props.ISO_A3 as string | undefined) ||
    (props.iso_a2 as string | undefined) ||
    (props.iso_a3 as string | undefined);
  return code ?? "";
};

export const getCountryName = (feature: CountryFeature) => {
  const props = feature.properties ?? {};
  return (
    (props.ADMIN as string | undefined) ||
    (props.name as string | undefined) ||
    (props.NAME as string | undefined) ||
    (props.name_en as string | undefined) ||
    (props.id as string | undefined) ||
    (feature.id as string | undefined) ||
    "Unknown"
  );
};

const collectCoordinates = (coords: unknown, bucket: number[][]) => {
  if (!coords) return;
  if (Array.isArray(coords) && coords.length >= 2) {
    const first = coords[0];
    const second = coords[1];
    if (typeof first === "number" && typeof second === "number") {
      bucket.push([first, second]);
      return;
    }
    coords.forEach((item) => collectCoordinates(item, bucket));
  }
};

export const getFeatureCenter = (feature: CountryFeature) => {
  const bucket: number[][] = [];
  const collectGeometry = (geometry: Geometry) => {
    if (geometry.type === "GeometryCollection") {
      geometry.geometries.forEach(collectGeometry);
    } else {
      collectCoordinates(geometry.coordinates, bucket);
    }
  };
  if (feature.geometry) {
    collectGeometry(feature.geometry);
  }
  if (bucket.length === 0) {
    return { lat: 0, lon: 0 };
  }
  const sums = bucket.reduce(
    (acc, [lon, lat]) => {
      acc.lat += lat;
      acc.lon += lon;
      return acc;
    },
    { lat: 0, lon: 0 }
  );
  return {
    lat: sums.lat / bucket.length,
    lon: sums.lon / bucket.length,
  };
};

export const latLonToVector = (lat: number, lon: number, radius: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new Vector3(x, y, z);
};
