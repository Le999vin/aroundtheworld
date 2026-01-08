import type { POI } from "@/lib/types";
import type { Bbox, LatLon } from "@/lib/data/pois/utils";

export type CityDataset = {
  id: string;
  center: LatLon;
  bbox?: Bbox;
  loader: () => Promise<POI[]>;
};

export const countryDatasets: Record<string, () => Promise<POI[]>> = {
  AE: async () =>
    (await import("./datasets/countries/AE.json")).default as POI[],
  CH: async () =>
    (await import("./datasets/countries/CH.json")).default as POI[],
  DE: async () =>
    (await import("./datasets/countries/DE.json")).default as POI[],
  ES: async () =>
    (await import("./datasets/countries/ES.json")).default as POI[],
  FR: async () =>
    (await import("./datasets/countries/FR.json")).default as POI[],
  GB: async () =>
    (await import("./datasets/countries/GB.json")).default as POI[],
  GR: async () =>
    (await import("./datasets/countries/GR.json")).default as POI[],
  IT: async () =>
    (await import("./datasets/countries/IT.json")).default as POI[],
  JP: async () =>
    (await import("./datasets/countries/JP.json")).default as POI[],
  NL: async () =>
    (await import("./datasets/countries/NL.json")).default as POI[],
  TH: async () =>
    (await import("./datasets/countries/TH.json")).default as POI[],
  TR: async () =>
    (await import("./datasets/countries/TR.json")).default as POI[],
  US: async () =>
    (await import("./datasets/countries/US.json")).default as POI[],
};

export const cityDatasets: Record<string, CityDataset> = {
  amsterdam: {
    id: "amsterdam",
    center: { lat: 52.3676, lon: 4.9041 },
    bbox: { minLat: 52.3, minLon: 4.75, maxLat: 52.42, maxLon: 5.05 },
    loader: async () =>
      (await import("./datasets/cities/amsterdam.json")).default as POI[],
  },
  athens: {
    id: "athens",
    center: { lat: 37.9838, lon: 23.7275 },
    bbox: { minLat: 37.9, minLon: 23.65, maxLat: 38.05, maxLon: 23.82 },
    loader: async () =>
      (await import("./datasets/cities/athens.json")).default as POI[],
  },
  bangkok: {
    id: "bangkok",
    center: { lat: 13.7563, lon: 100.5018 },
    bbox: { minLat: 13.6, minLon: 100.35, maxLat: 13.85, maxLon: 100.65 },
    loader: async () =>
      (await import("./datasets/cities/bangkok.json")).default as POI[],
  },
  barcelona: {
    id: "barcelona",
    center: { lat: 41.3874, lon: 2.1686 },
    bbox: { minLat: 41.32, minLon: 2.05, maxLat: 41.45, maxLon: 2.25 },
    loader: async () =>
      (await import("./datasets/cities/barcelona.json")).default as POI[],
  },
  berlin: {
    id: "berlin",
    center: { lat: 52.52, lon: 13.405 },
    bbox: { minLat: 52.4, minLon: 13.2, maxLat: 52.6, maxLon: 13.55 },
    loader: async () =>
      (await import("./datasets/cities/berlin.json")).default as POI[],
  },
  dubai: {
    id: "dubai",
    center: { lat: 25.2048, lon: 55.2708 },
    bbox: { minLat: 25.05, minLon: 55.1, maxLat: 25.35, maxLon: 55.35 },
    loader: async () =>
      (await import("./datasets/cities/dubai.json")).default as POI[],
  },
  istanbul: {
    id: "istanbul",
    center: { lat: 41.0082, lon: 28.9784 },
    bbox: { minLat: 40.85, minLon: 28.75, maxLat: 41.15, maxLon: 29.15 },
    loader: async () =>
      (await import("./datasets/cities/istanbul.json")).default as POI[],
  },
  london: {
    id: "london",
    center: { lat: 51.5074, lon: -0.1278 },
    bbox: { minLat: 51.35, minLon: -0.5, maxLat: 51.6, maxLon: 0.1 },
    loader: async () =>
      (await import("./datasets/cities/london.json")).default as POI[],
  },
  mumbai: {
    id: "mumbai",
    center: { lat: 19.076, lon: 72.8777 },
    bbox: { minLat: 18.85, minLon: 72.75, maxLat: 19.35, maxLon: 73.1 },
    loader: async () =>
      (await import("./datasets/cities/mumbai.json")).default as POI[],
  },
  munich: {
    id: "munich",
    center: { lat: 48.1351, lon: 11.582 },
    bbox: { minLat: 48.05, minLon: 11.4, maxLat: 48.2, maxLon: 11.7 },
    loader: async () =>
      (await import("./datasets/cities/munich.json")).default as POI[],
  },
  "new-york": {
    id: "new-york",
    center: { lat: 40.7128, lon: -74.006 },
    bbox: { minLat: 40.55, minLon: -74.25, maxLat: 40.9, maxLon: -73.7 },
    loader: async () =>
      (await import("./datasets/cities/new-york.json")).default as POI[],
  },
  paris: {
    id: "paris",
    center: { lat: 48.8566, lon: 2.3522 },
    bbox: { minLat: 48.8, minLon: 2.2, maxLat: 48.92, maxLon: 2.42 },
    loader: async () =>
      (await import("./datasets/cities/paris.json")).default as POI[],
  },
  rome: {
    id: "rome",
    center: { lat: 41.9028, lon: 12.4964 },
    bbox: { minLat: 41.8, minLon: 12.35, maxLat: 42.0, maxLon: 12.65 },
    loader: async () =>
      (await import("./datasets/cities/rome.json")).default as POI[],
  },
  tokyo: {
    id: "tokyo",
    center: { lat: 35.6895, lon: 139.6917 },
    bbox: { minLat: 35.55, minLon: 139.55, maxLat: 35.8, maxLon: 139.85 },
    loader: async () =>
      (await import("./datasets/cities/tokyo.json")).default as POI[],
  },
  zurich: {
    id: "zurich",
    center: { lat: 47.3769, lon: 8.5417 },
    bbox: { minLat: 47.3, minLon: 8.45, maxLat: 47.45, maxLon: 8.65 },
    loader: async () =>
      (await import("./datasets/cities/zurich.json")).default as POI[],
  },
};
