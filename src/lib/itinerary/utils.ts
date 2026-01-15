import type { ItineraryStop } from "@/lib/itinerary/types";
import type { POI } from "@/lib/types";

export const createStopFromPoi = (poi: POI): ItineraryStop => ({
  id: poi.id,
  name: poi.name,
  lat: poi.lat,
  lon: poi.lon,
  category: poi.category,
  city: poi.city,
  countryCode: poi.countryCode,
});
