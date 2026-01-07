import { ServiceError } from "@/lib/services/errors";
import { PhotonGeocodingService } from "@/lib/services/geocoding/photon";
import type { GeocodingService } from "@/lib/services/geocoding/types";

export type { GeocodingService } from "@/lib/services/geocoding/types";

export const getGeocodingService = (): GeocodingService => {
  const provider = process.env.GEOCODING_PROVIDER ?? "photon";
  if (provider === "photon") {
    return new PhotonGeocodingService();
  }
  throw new ServiceError(`Unsupported geocoding provider: ${provider}`, {
    status: 400,
    code: "provider_unsupported",
  });
};
