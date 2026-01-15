import type { POI } from "@/lib/types";

type GoogleMapsPoi = Pick<
  POI,
  "name" | "lat" | "lon" | "address" | "city" | "googlePlaceId"
>;

const isNonEmpty = (value?: string) =>
  Boolean(value && value.trim().length > 0);

const joinParts = (parts: Array<string | undefined>) =>
  parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");

export const buildGoogleMapsUrl = (poi: GoogleMapsPoi) => {
  const name = isNonEmpty(poi.name) ? poi.name.trim() : "";
  const latLon = `${poi.lat},${poi.lon}`;
  const fallbackQuery = name || latLon;

  if (isNonEmpty(poi.googlePlaceId)) {
    const query = encodeURIComponent(fallbackQuery);
    const placeId = encodeURIComponent(poi.googlePlaceId!.trim());
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
  }

  if (isNonEmpty(poi.address) || isNonEmpty(poi.city)) {
    const queryText = joinParts([name, poi.address, poi.city]) || fallbackQuery;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(latLon)}`;
};
