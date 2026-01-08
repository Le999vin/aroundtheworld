import type { NextRequest } from "next/server";
import { handlePoisRequest } from "@/app/api/pois/handler";

export async function GET(request: NextRequest) {
  // Deprecated: use /api/pois with country/city/lat/lon selectors.
  return handlePoisRequest(request, {
    requireLatLon: true,
    allowCountry: false,
    allowCity: false,
    defaultCategory: "all",
    logContext: "api/static-places",
  });
}
