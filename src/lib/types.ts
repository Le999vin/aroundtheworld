export type Coordinates = {
  lat: number;
  lon: number;
};

export type City = Coordinates & {
  name: string;
};

export type PlaceCategory =
  | "landmarks"
  | "museums"
  | "food"
  | "nightlife"
  | "nature"
  | "other";

export type PlaceSummary = {
  name: string;
  category: PlaceCategory;
};

export type Country = Coordinates & {
  code: string;
  name: string;
  capital?: string;
  population?: number;
  topCities?: City[];
  topPlaces?: PlaceSummary[];
};

export type WeatherCondition = {
  tempC: number;
  description: string;
  icon: string;
  windKph?: number;
  humidity?: number;
};

export type WeatherForecastDay = {
  date: string;
  minC: number;
  maxC: number;
  icon: string;
  description: string;
};

export type WeatherError = {
  message: string;
  code?: string;
  status?: number;
};

export type WeatherData = {
  provider: string;
  location: Coordinates;
  current: WeatherCondition;
  daily: WeatherForecastDay[];
  errors?: {
    current?: WeatherError;
    forecast?: WeatherError;
  };
};

export type PoiImageSource = "wikimedia" | "wikipedia";

export type PoiImage = {
  url: string;
  source: PoiImageSource;
  attribution?: string;
};

export type POI = Coordinates & {
  id: string;
  name: string;
  category: PlaceCategory;
  source: "static" | "curated" | "opentripmap";
  countryCode?: string;
  cityId?: string;
  city?: string;
  googlePlaceId?: string;
  description?: string;
  address?: string;
  rating?: number;
  website?: string;
  mapsUrl?: string;
  imageUrl?: string;
  images?: PoiImage[];
  openingHours?: string;
  osm?: { type: "N" | "W" | "R"; id: number };
  tags?: string[];
};

export type GeocodeResult = Coordinates & {
  name: string;
  country?: string;
  type?: string;
};

export type Focus = Coordinates & {
  kind: "country" | "city";
  code?: string;
  name: string;
  source: "globe" | "search" | "map";
};
