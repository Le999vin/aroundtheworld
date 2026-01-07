import { ServiceError } from "@/lib/services/errors";
import { OpenTripMapPlacesService } from "@/lib/services/places/opentripmap";
import type { PlacesService } from "@/lib/services/places/types";

export type { PlacesOptions, PlacesService } from "@/lib/services/places/types";

export const getPlacesService = (): PlacesService => {
  const provider = process.env.PLACES_PROVIDER ?? "opentripmap";
  if (provider === "opentripmap") {
    return new OpenTripMapPlacesService();
  }
  throw new ServiceError(`Unsupported places provider: ${provider}`, {
    status: 400,
    code: "provider_unsupported",
  });
};
