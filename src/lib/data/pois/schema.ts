export type PlaceCategory =
  | "landmarks"
  | "museums"
  | "food"
  | "nightlife"
  | "nature"
  | "other";

export type StaticPOI = {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lon: number;
  rating?: number;
  address?: string;
  source: "static";
  description?: string;
  imageUrl?: string;
};

const CATEGORIES: PlaceCategory[] = [
  "landmarks",
  "museums",
  "food",
  "nightlife",
  "nature",
  "other",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isCategory = (value: unknown): value is PlaceCategory =>
  isString(value) && CATEGORIES.includes(value as PlaceCategory);

export const parseStaticPois = (
  data: unknown,
  context: string
): StaticPOI[] => {
  if (!Array.isArray(data)) {
    console.warn(`[static-pois] Dataset ${context} is not an array.`);
    return [];
  }

  const valid: StaticPOI[] = [];

  data.forEach((item, index) => {
    if (!isRecord(item)) {
      console.warn(
        `[static-pois] Invalid POI at ${context}[${index}]: not an object.`
      );
      return;
    }

    const { id, name, category, lat, lon, rating, address, description, imageUrl, source } = item;

    if (!isString(id) || !isString(name) || !isCategory(category)) {
      console.warn(
        `[static-pois] Invalid POI at ${context}[${index}]: required fields missing.`
      );
      return;
    }

    if (!isNumber(lat) || !isNumber(lon)) {
      console.warn(
        `[static-pois] Invalid POI at ${context}[${index}]: lat/lon invalid.`
      );
      return;
    }

    if (source !== "static") {
      console.warn(
        `[static-pois] Invalid POI at ${context}[${index}]: source must be "static".`
      );
      return;
    }

    valid.push({
      id,
      name,
      category,
      lat,
      lon,
      source: "static",
      rating: isNumber(rating) ? rating : undefined,
      address: isString(address) ? address : undefined,
      description: isString(description) ? description : undefined,
      imageUrl: isString(imageUrl) ? imageUrl : undefined,
    });
  });

  return valid;
};
