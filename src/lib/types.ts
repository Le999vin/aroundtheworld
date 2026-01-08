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

export type POI = Coordinates & {
  id: string;
  name: string;
  category: PlaceCategory;
  source: "static" | "curated" | "opentripmap";
  countryCode?: string;
  cityId?: string;
  description?: string;
  address?: string;
  rating?: number;
  website?: string;
  imageUrl?: string;
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
