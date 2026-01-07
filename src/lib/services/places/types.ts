import type { POI, PlaceCategory } from "@/lib/types";

export type PlacesOptions = {
  radius: number;
  category?: PlaceCategory;
  kinds?: string;
  limit?: number;
  lang?: string;
};

export interface PlacesService {
  provider: string;
  searchPlaces(
    lat: number,
    lon: number,
    options: PlacesOptions
  ): Promise<POI[]>;
}
