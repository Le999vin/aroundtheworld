import type { POI, PlaceCategory } from "@/lib/types";
import { ServiceError, readResponseBody, requireEnv } from "@/lib/services/errors";
import type { PlacesOptions, PlacesService } from "@/lib/services/places/types";

const CATEGORY_KINDS: Record<PlaceCategory, string> = {
  landmarks: "interesting_places,architecture,monuments_and_memorials",
  museums: "museums",
  food: "foods",
  nightlife: "nightclubs,bars",
  nature: "natural,parks",
  other: "interesting_places",
};

const resolveCategoryFromKinds = (kinds?: string): PlaceCategory => {
  if (!kinds) return "landmarks";
  const normalized = kinds.toLowerCase();
  if (normalized.includes("museums")) return "museums";
  if (normalized.includes("foods")) return "food";
  if (
    normalized.includes("nightclubs") ||
    normalized.includes("bars") ||
    normalized.includes("adult")
  ) {
    return "nightlife";
  }
  if (normalized.includes("natural") || normalized.includes("parks")) {
    return "nature";
  }
  if (
    normalized.includes("interesting_places") ||
    normalized.includes("architecture") ||
    normalized.includes("monuments")
  ) {
    return "landmarks";
  }
  return "other";
};

export class OpenTripMapPlacesService implements PlacesService {
  provider = "opentripmap";

  async searchPlaces(
    lat: number,
    lon: number,
    options: PlacesOptions
  ): Promise<POI[]> {
    const apiKey = requireEnv("OPENTRIPMAP_API_KEY");
    const radius = options.radius ?? 50000;
    const limit = options.limit ?? 12;
    const category =
      options.category ?? resolveCategoryFromKinds(options.kinds);
    const kinds = options.kinds ?? CATEGORY_KINDS[category] ?? CATEGORY_KINDS.other;
    const lang = options.lang ?? "de";

    const url = new URL(
      `https://api.opentripmap.com/0.1/${lang}/places/radius`
    );
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lon", lon.toString());
    url.searchParams.set("radius", radius.toString());
    url.searchParams.set("kinds", kinds);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("apikey", apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (error) {
      throw new ServiceError("Places provider request failed", {
        status: 502,
        code: "provider_error",
        cause: error,
      });
    }
    if (!response.ok) {
      const body = await readResponseBody(response);
      throw new ServiceError("Places provider error", {
        status: response.status,
        code: "provider_error",
        details: body,
      });
    }

    const data = (await response.json()) as {
      features: {
        properties: {
          name: string;
          xid: string;
          rate?: number;
          kinds?: string;
        };
        geometry: { coordinates: [number, number] };
      }[];
    };

    const fetchDetails = async (xid: string) => {
      const detailsUrl = new URL(
        `https://api.opentripmap.com/0.1/${lang}/places/xid/${encodeURIComponent(xid)}`
      );
      detailsUrl.searchParams.set("apikey", apiKey);

      try {
        const res = await fetch(detailsUrl.toString());
        if (!res.ok) return null;
        return (await res.json()) as {
          xid: string;
          name?: string;
          kinds?: string;
          rate?: number;
          point?: { lat: number; lon: number };
          preview?: { source?: string };
          wikipedia_extracts?: { title?: string; text?: string };
        };
      } catch {
        return null;
      }

    };

    const base = data.features
      .filter((item) => item.properties.name)
      .slice(0, limit)
      .map((item) => ({
        id: item.properties.xid,
        name: item.properties.name,
        category,
        lon: item.geometry.coordinates[0],
        lat: item.geometry.coordinates[1],
        rating: item.properties.rate
          ? Math.min(5, Number(item.properties.rate))
          : undefined,
        source: this.provider,
        _kinds: item.properties.kinds,
      }));

    // Fetch details for better descriptions/images when available.
    // Keep it bounded by `limit` so we don't spam the API (free plan rate limits apply).
    const detailsList = await Promise.all(
      base.map((p) => fetchDetails(p.id).catch(() => null))
    );

    return base.map((p, idx) => {
      const details = detailsList[idx];
      const inferredCategory = resolveCategoryFromKinds(details?.kinds ?? p._kinds);

      return {
        id: p.id,
        name: details?.name || p.name,
        category: inferredCategory,
        lon: details?.point?.lon ?? p.lon,
        lat: details?.point?.lat ?? p.lat,
        rating:
          typeof details?.rate === "number"
            ? Math.min(5, Number(details.rate))
            : p.rating,
        source: p.source,
        // optional extras (if your POI type supports them, otherwise harmless to ignore)
        imageUrl: details?.preview?.source,
        description: details?.wikipedia_extracts?.text,
      } as unknown as POI;
    });
  }
}

export const getPlaces = (
  lat: number,
  lon: number,
  radius = 50000,
  kinds?: string,
  lang?: string
) =>
  new OpenTripMapPlacesService().searchPlaces(lat, lon, {
    radius,
    kinds,
    category: resolveCategoryFromKinds(kinds),
    lang,
  });
