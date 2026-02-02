import type { Bbox } from "@/lib/stays/types";

type AirbnbSearchParams = {
  bbox: Bbox;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  guests?: number;
};

export const buildAirbnbSearchUrl = ({
  bbox,
  minPrice,
  maxPrice,
  currency = "EUR",
  guests,
}: AirbnbSearchParams) => {
  const url = new URL("https://www.airbnb.ch/s/Map/homes");
  url.searchParams.set("sw_lat", bbox.minLat.toString());
  url.searchParams.set("sw_lng", bbox.minLon.toString());
  url.searchParams.set("ne_lat", bbox.maxLat.toString());
  url.searchParams.set("ne_lng", bbox.maxLon.toString());
  if (Number.isFinite(minPrice)) {
    url.searchParams.set("price_min", Math.round(minPrice as number).toString());
  }
  if (Number.isFinite(maxPrice)) {
    url.searchParams.set("price_max", Math.round(maxPrice as number).toString());
  }
  if (currency) {
    url.searchParams.set("currency", currency);
  }
  if (guests && Number.isFinite(guests)) {
    url.searchParams.set("adults", Math.max(1, Math.round(guests)).toString());
  }
  return url.toString();
};
