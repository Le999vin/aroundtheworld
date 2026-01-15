import { z } from "zod";
import { ServiceError } from "@/lib/services/errors";
import type { POI, PlaceCategory } from "@/lib/types";
import { PLACE_CATEGORIES } from "@/lib/data/pois/constants";
import { normalizeCityId, normalizeCountryCode } from "@/lib/data/pois/utils";

export type { PlaceCategory } from "@/lib/types";
export { PLACE_CATEGORIES } from "@/lib/data/pois/constants";

const isCountryCode = (value: string) => /^[A-Z]{2,3}$/.test(value);

const categorySchema = z.enum(PLACE_CATEGORIES);

const trimmedString = z.string().trim().min(1);

const latSchema = z
  .number()
  .finite()
  .refine((value) => Math.abs(value) <= 90, {
    message: "lat must be between -90 and 90.",
  });

const lonSchema = z
  .number()
  .finite()
  .refine((value) => Math.abs(value) <= 180, {
    message: "lon must be between -180 and 180.",
  });

const countryCodeSchema = trimmedString
  .transform((value) => normalizeCountryCode(value))
  .refine((value): value is string => Boolean(value) && isCountryCode(value), {
    message: "countryCode must be ISO-2 or ISO-3.",
  });

const cityIdSchema = trimmedString
  .transform((value) => normalizeCityId(value))
  .refine((value): value is string => Boolean(value), {
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
  category: categorySchema,
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

export const parsePoisDataset = (data: unknown, context: string): POI[] => {
  const parsed = poiDatasetSchema.safeParse(data);
  if (parsed.success) return parsed.data as POI[];

  const issue = parsed.error.issues[0];
  const location = issue ? formatIssuePath(issue.path) : "";
  const detail = issue?.message ?? "invalid data";
  const suffix = location ? ` ${location}` : "";

  throw new ServiceError(`Invalid POI dataset ${context}${suffix}: ${detail}`, {
    status: 500,
    code: "unexpected",
  });
};
