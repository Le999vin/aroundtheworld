import type { GeocodeResult } from "@/lib/types";

export interface GeocodingService {
  provider: string;
  geocode(query: string): Promise<GeocodeResult[]>;
}
