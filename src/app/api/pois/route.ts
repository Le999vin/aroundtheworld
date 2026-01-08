import type { NextRequest } from "next/server";
import { handlePoisRequest } from "@/app/api/pois/handler";

export async function GET(request: NextRequest) {
  return handlePoisRequest(request);
}
