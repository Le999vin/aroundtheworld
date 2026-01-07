import { afterEach, describe, expect, it, vi } from "vitest";
import { getWeatherService } from "@/lib/services/weather";
import { getPlacesService } from "@/lib/services/places";
import { getGeocodingService } from "@/lib/services/geocoding";

const resetEnv = () => {
  vi.unstubAllEnvs();
  delete process.env.WEATHER_PROVIDER;
  delete process.env.PLACES_PROVIDER;
  delete process.env.GEOCODING_PROVIDER;
};

afterEach(() => {
  resetEnv();
});

describe("service selection", () => {
  it("defaults to openweather", () => {
    const service = getWeatherService();
    expect(service.provider).toBe("openweather");
  });

  it("defaults to opentripmap", () => {
    const service = getPlacesService();
    expect(service.provider).toBe("opentripmap");
  });

  it("defaults to photon", () => {
    const service = getGeocodingService();
    expect(service.provider).toBe("photon");
  });

  it("throws on unsupported providers", () => {
    vi.stubEnv("WEATHER_PROVIDER", "unknown");
    vi.stubEnv("PLACES_PROVIDER", "unknown");
    vi.stubEnv("GEOCODING_PROVIDER", "unknown");

    expect(() => getWeatherService()).toThrow();
    expect(() => getPlacesService()).toThrow();
    expect(() => getGeocodingService()).toThrow();
  });
});
