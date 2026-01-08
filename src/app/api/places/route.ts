import type { NextRequest } from "next/server";
import { handlePoisRequest } from "@/app/api/pois/handler";

export async function GET(request: NextRequest) {
  // Deprecated alias for /api/pois. External providers are disabled.
  return handlePoisRequest(request, { logContext: "api/places" });
}
