import { ServiceError } from "@/lib/services/errors";
import type { POI, PlaceCategory } from "@/lib/types";
import { normalizeCityId, normalizeCountryCode } from "@/lib/data/pois/utils";

export type { PlaceCategory } from "@/lib/types";

export const PLACE_CATEGORIES: PlaceCategory[] = [
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

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isCategory = (value: unknown): value is PlaceCategory =>
  isString(value) && PLACE_CATEGORIES.includes(value as PlaceCategory);

const isCountryCode = (value: string) => /^[A-Z]{2,3}$/.test(value);

const fail = (context: string, index: number, reason: string): never => {
  throw new ServiceError(`Invalid POI dataset ${context}[${index}]: ${reason}`, {
    status: 500,
    code: "unexpected",
  });
};

const parseOptionalString = (value: unknown, context: string, index: number) => {
  if (value === undefined) return undefined;
  if (isString(value)) return value;
  fail(context, index, "optional string field is invalid.");
  return undefined;
};

const parseOptionalNumber = (value: unknown, context: string, index: number) => {
  if (value === undefined) return undefined;
  if (isNumber(value)) return value;
  fail(context, index, "optional number field is invalid.");
  return undefined;
};

const parsePoi = (value: unknown, context: string, index: number): POI => {
  if (!isRecord(value)) {
    fail(context, index, "item is not an object.");
  }

  const record = value as Record<string, unknown>;
  const idValue = record["id"];
  const nameValue = record["name"];
  const categoryValue = record["category"];
  const latValue = record["lat"];
  const lonValue = record["lon"];
  const sourceValue = record["source"];

  if (!isString(idValue) || !idValue.trim()) {
    fail(context, index, "id is required.");
  }

  if (!isString(nameValue) || !nameValue.trim()) {
    fail(context, index, "name is required.");
  }

  if (!isCategory(categoryValue)) {
    fail(context, index, "category is invalid.");
  }

  if (!isNumber(latValue) || !isNumber(lonValue)) {
    fail(context, index, "lat/lon are invalid.");
  }

  if (sourceValue !== "static") {
    fail(context, index, 'source must be \"static\".');
  }

  const id = (idValue as string).trim();
  const name = (nameValue as string).trim();
  const category = categoryValue as PlaceCategory;
  const lat = latValue as number;
  const lon = lonValue as number;

  const countryCodeRaw = parseOptionalString(
    record["countryCode"],
    context,
    index
  );
  const cityIdRaw = parseOptionalString(record["cityId"], context, index);

  const normalizedCountryCode = countryCodeRaw
    ? normalizeCountryCode(countryCodeRaw)
    : null;
  const countryCode = normalizedCountryCode ?? undefined;
  if (
    countryCodeRaw &&
    (!normalizedCountryCode || !isCountryCode(normalizedCountryCode))
  ) {
    fail(context, index, "countryCode must be ISO-2 or ISO-3.");
  }

  const normalizedCityId = cityIdRaw ? normalizeCityId(cityIdRaw) : null;
  const cityId = normalizedCityId ?? undefined;
  if (cityIdRaw && !normalizedCityId) {
    fail(context, index, "cityId is invalid.");
  }

  const tags = record["tags"];
  if (tags !== undefined && !isStringArray(tags)) {
    fail(context, index, "tags must be an array of strings.");
  }

  return {
    id,
    name,
    category,
    lat,
    lon,
    source: "static",
    countryCode,
    cityId,
    description: parseOptionalString(record["description"], context, index),
    address: parseOptionalString(record["address"], context, index),
    rating: parseOptionalNumber(record["rating"], context, index),
    website: parseOptionalString(record["website"], context, index),
    imageUrl: parseOptionalString(record["imageUrl"], context, index),
    tags: tags as string[] | undefined,
  };
};

export const parsePoisDataset = (data: unknown, context: string): POI[] => {
  if (!Array.isArray(data)) {
    throw new ServiceError(`Invalid POI dataset ${context}: not an array.`, {
      status: 500,
      code: "unexpected",
    });
  }

  return data.map((item, index) => parsePoi(item, context, index));
};
