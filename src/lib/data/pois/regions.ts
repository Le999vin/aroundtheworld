import type { StaticPOI } from "@/lib/data/pois/schema";

export type Region = {
  id: string;
  label: string;
  bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number };
  dataset: () => Promise<StaticPOI[]>;
};

export const fallbackRegion: Region = {
  id: "global.sample",
  label: "Global Sample",
  bbox: { minLat: -90, minLon: -180, maxLat: 90, maxLon: 180 },
  dataset: async () =>
    (await import("./datasets/global.sample.json")).default as StaticPOI[],
};

export const regions: Region[] = [
  {
    id: "mumbai",
    label: "Mumbai",
    bbox: { minLat: 18.85, minLon: 72.75, maxLat: 19.35, maxLon: 73.1 },
    dataset: async () =>
      (await import("./datasets/mumbai.json")).default as StaticPOI[],
  },
  {
    id: "zurich",
    label: "Zuerich",
    bbox: { minLat: 47.3, minLon: 8.45, maxLat: 47.45, maxLon: 8.65 },
    dataset: async () =>
      (await import("./datasets/zurich.json")).default as StaticPOI[],
  },
  {
    id: "paris",
    label: "Paris",
    bbox: { minLat: 48.8, minLon: 2.2, maxLat: 48.92, maxLon: 2.42 },
    dataset: async () =>
      (await import("./datasets/paris.json")).default as StaticPOI[],
  },
];

export const findRegionForCenter = (center: { lat: number; lon: number }) =>
  regions.find(
    (region) =>
      center.lat >= region.bbox.minLat &&
      center.lat <= region.bbox.maxLat &&
      center.lon >= region.bbox.minLon &&
      center.lon <= region.bbox.maxLon
  ) ?? fallbackRegion;
