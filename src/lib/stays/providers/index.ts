import { ServiceError } from "@/lib/services/errors";
import type { Bbox, Stay } from "@/lib/stays/types";
import { fetchMockStays } from "@/lib/stays/providers/mock";
import { fetchPartnerStays } from "@/lib/stays/providers/partner";

export type StaySearchParams = {
  bbox: Bbox;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  country?: string;
  limit?: number;
};

export type StaysProviderName = "mock" | "partner";

export const getStaysProvider = (provider?: string) => {
  const normalized = (provider ?? "mock").toLowerCase();
  if (normalized === "mock") {
    return {
      name: "mock" as const,
      search: (params: StaySearchParams) => fetchMockStays(params),
    };
  }
  if (normalized === "partner") {
    return {
      name: "partner" as const,
      search: (params: StaySearchParams) => fetchPartnerStays(params),
    };
  }
  throw new ServiceError(`Unsupported stays provider: ${provider}`, {
    status: 400,
    code: "provider_unsupported",
  });
};

export type { Stay };
