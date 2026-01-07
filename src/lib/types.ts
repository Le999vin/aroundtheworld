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

export type WeatherData = {
  provider: string;
  location: Coordinates;
  current: WeatherCondition;
  daily: WeatherForecastDay[];
};

export type POI = Coordinates & {
  id: string;
  name: string;
  category: PlaceCategory;
  rating?: number;
  address?: string;
  imageUrl?: string;
  source?: string;
};

export type GeocodeResult = Coordinates & {
  name: string;
  country?: string;
  type?: string;
};
