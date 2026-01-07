import type { WeatherData } from "@/lib/types";

export type WeatherUnits = "metric" | "imperial";

export type WeatherOptions = {
  units?: WeatherUnits;
  lang?: string;
};

export interface WeatherService {
  provider: string;
  getWeather(lat: number, lon: number, options?: WeatherOptions): Promise<WeatherData>;
}
