import {
  ServiceError,
  readResponseBody,
  requireEnv,
} from "@/lib/services/errors";
import type { Bbox, Stay } from "@/lib/stays/types";

type StaySearchParams = {
  bbox: Bbox;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  country?: string;
  limit?: number;
};

type PartnerStay = Partial<{
  id: string | number;
  title: string;
  name: string;
  lat: number;
  lon: number;
  latitude: number;
  longitude: number;
  lng: number;
  price: number;
  currency: string;
  imageUrl: string;
  image: string;
  rating: number;
  url: string;
  link: string;
  countryCode: string;
  country: string;
}>;

const mapPartnerStay = (stay: PartnerStay, fallbackCountry?: string): Stay | null => {
  const id =
    typeof stay.id === "string"
      ? stay.id
      : typeof stay.id === "number"
        ? stay.id.toString()
        : "";
  const title = stay.title ?? stay.name ?? "";
  const lat = stay.lat ?? stay.latitude;
  const lon = stay.lon ?? stay.longitude ?? stay.lng;
  const price = stay.price;
  const currency = stay.currency ?? "EUR";
  const countryCode =
    (stay.countryCode ?? stay.country ?? fallbackCountry ?? "").toString().trim().toUpperCase();
  if (!id || !title || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (!Number.isFinite(price)) return null;
  if (!countryCode) return null;
  return {
    id,
    title,
    lat: lat as number,
    lon: lon as number,
    price: price as number,
    currency,
    countryCode,
    imageUrl: stay.imageUrl ?? stay.image,
    rating: Number.isFinite(stay.rating) ? (stay.rating as number) : undefined,
    url: stay.url ?? stay.link ?? "",
    source: "partner",
  };
};

export const fetchPartnerStays = async ({
  bbox,
  minPrice,
  maxPrice,
  currency,
  country,
  limit = 200,
}: StaySearchParams): Promise<Stay[]> => {
  const endpoint = requireEnv("STAYS_PARTNER_ENDPOINT");
  const apiKey = requireEnv("STAYS_PARTNER_KEY");
  const url = new URL(endpoint);
  url.searchParams.set(
    "bbox",
    `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`
  );
  if (Number.isFinite(minPrice)) {
    url.searchParams.set("minPrice", `${minPrice}`);
  }
  if (Number.isFinite(maxPrice)) {
    url.searchParams.set("maxPrice", `${maxPrice}`);
  }
  if (currency) {
    url.searchParams.set("currency", currency);
  }
  if (country) {
    url.searchParams.set("country", country);
  }
  url.searchParams.set("limit", `${limit}`);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await readResponseBody(response);
    throw new ServiceError("Partner stays request failed", {
      status: response.status,
      code: "provider_error",
      details: body,
    });
  }

  const payload = (await response.json()) as unknown;
  const items =
    Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { stays?: unknown[] }).stays)
        ? (payload as { stays: unknown[] }).stays
        : Array.isArray((payload as { items?: unknown[] }).items)
          ? (payload as { items: unknown[] }).items
          : null;

  if (!items) {
    throw new ServiceError("Unexpected partner stays payload", {
      status: 500,
      code: "provider_error",
      details: payload,
    });
  }

  return items
    .map((entry) => mapPartnerStay(entry as PartnerStay, country))
    .filter((entry): entry is Stay => Boolean(entry))
    .slice(0, Math.min(limit, 300));
};
