import type { PlaceCategory } from "@/lib/types";

export const PLACE_CATEGORIES = [
  "landmarks",
  "museums",
  "food",
  "nightlife",
  "nature",
  "other",
] as const satisfies readonly PlaceCategory[];

export const PLACE_CATEGORY_OPTIONS = ["all", ...PLACE_CATEGORIES] as const;
