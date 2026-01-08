import type { GeocodeResult } from "@/lib/types";
import { ServiceError, readResponseBody } from "@/lib/services/errors";
import type { GeocodingService } from "@/lib/services/geocoding/types";

export class PhotonGeocodingService implements GeocodingService {
  provider = "photon";

  async geocode(query: string): Promise<GeocodeResult[]> {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("lang", "de");
    url.searchParams.set("limit", "5");

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (error) {
      throw new ServiceError("Geocoding provider request failed", {
        status: 502,
        code: "provider_error",
        cause: error,
      });
    }
    if (!response.ok) {
      const body = await readResponseBody(response);
      throw new ServiceError("Geocoding provider error", {
        status: response.status,
        code: "provider_error",
        details: body,
      });
    }

    const data = (await response.json()) as {
      features: {
        properties: {
          name: string;
          country?: string;
          type?: string;
        };
        geometry: { coordinates: [number, number] };
      }[];
    };

    return data.features.map((feature) => ({
      name: feature.properties.name,
      country: feature.properties.country,
      type: feature.properties.type,
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
    }));
  }
}
