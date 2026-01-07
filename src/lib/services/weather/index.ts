import { ServiceError } from "@/lib/services/errors";
import { OpenWeatherService } from "@/lib/services/weather/openweather";
import type { WeatherService } from "@/lib/services/weather/types";

export type { WeatherOptions, WeatherService } from "@/lib/services/weather/types";

export const getWeatherService = (): WeatherService => {
  const provider = process.env.WEATHER_PROVIDER ?? "openweather";
  if (provider === "openweather") {
    return new OpenWeatherService();
  }
  throw new ServiceError(`Unsupported weather provider: ${provider}`, {
    status: 400,
    code: "provider_unsupported",
  });
};
