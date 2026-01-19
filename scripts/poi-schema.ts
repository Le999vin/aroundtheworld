const { z } = require("zod");

const PLACE_CATEGORIES = [
  "landmarks",
  "museums",
  "food",
  "nightlife",
  "nature",
  "other",
];

const isCountryCode = (value: string) => /^[A-Z]{2,3}$/.test(value);

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

const trimmedString = z.string().trim().min(1);

const latSchema = z
  .number()
  .finite()
  .refine((value: number) => Math.abs(value) <= 90, {
    message: "lat must be between -90 and 90.",
  });

const lonSchema = z
  .number()
  .finite()
  .refine((value: number) => Math.abs(value) <= 180, {
    message: "lon must be between -180 and 180.",
  });

const countryCodeSchema = trimmedString
  .transform((value: string) => normalizeCountryCode(value))
  .refine((value: string | null): value is string => Boolean(value) && isCountryCode(value), {
    message: "countryCode must be ISO-2 or ISO-3.",
  });

const cityIdSchema = trimmedString
  .transform((value: string) => normalizeCityId(value))
  .refine((value: string | null): value is string => Boolean(value), {
    message: "cityId is invalid.",
  });

const poiImageSchema = z.object({
  url: trimmedString,
  source: z.enum(["wikimedia", "wikipedia"]),
  attribution: trimmedString.optional(),
});

const poiSchema = z.object({
  id: trimmedString,
  name: trimmedString,
  category: z.enum(PLACE_CATEGORIES),
  lat: latSchema,
  lon: lonSchema,
  source: z.literal("static"),
  countryCode: countryCodeSchema.optional(),
  cityId: cityIdSchema.optional(),
  city: trimmedString.optional(),
  googlePlaceId: trimmedString.optional(),
  description: trimmedString.optional(),
  address: trimmedString.optional(),
  rating: z.number().finite().optional(),
  website: trimmedString.optional(),
  mapsUrl: trimmedString.optional(),
  imageUrl: trimmedString.optional(),
  images: z.array(poiImageSchema).optional(),
  openingHours: trimmedString.optional(),
  osm: z
    .object({
      type: z.enum(["N", "W", "R"]),
      id: z.number().int().positive(),
    })
    .optional(),
  tags: z.array(trimmedString).optional(),
});

const poiDatasetSchema = z.array(poiSchema);

const formatIssuePath = (path: (string | number)[]) => {
  if (!path.length) return "";
  const [index, ...rest] = path;
  const suffix = rest.length ? `.${rest.join(".")}` : "";
  return typeof index === "number"
    ? `[${index}]${suffix}`
    : `[${index}${suffix}]`;
};

module.exports = {
  PLACE_CATEGORIES,
  normalizeCountryCode,
  normalizeCityId,
  poiSchema,
  poiDatasetSchema,
  formatIssuePath,
};
