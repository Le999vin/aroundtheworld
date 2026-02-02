export type Stay = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  price: number;
  currency: string;
  countryCode: string;
  imageUrl?: string;
  rating?: number;
  url: string;
  source: "mock" | "partner";
};

export type Bbox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};
