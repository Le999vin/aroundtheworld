import type { Itinerary, ItineraryStop } from "@/lib/itinerary/types";

const toBase64Url = (value: string) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = `${padded}${"=".repeat(padLength)}`;
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
};

const isValidStop = (value: unknown): value is ItineraryStop => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.lat === "number" &&
    typeof record.lon === "number"
  );
};

const normalizeStops = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const stops: ItineraryStop[] = [];
  for (const entry of value) {
    if (!isValidStop(entry)) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    stops.push(entry);
  }
  return stops;
};

export const encodeItinerary = (itinerary: Itinerary) => {
  if (typeof window === "undefined") return null;
  try {
    const json = JSON.stringify(itinerary);
    return toBase64Url(json);
  } catch {
    return null;
  }
};

export const decodeItinerary = (param: string | null) => {
  if (!param || typeof window === "undefined") return null;
  try {
    const json = fromBase64Url(param);
    const data = JSON.parse(json) as Partial<Itinerary>;
    const stops = normalizeStops(data.stops);
    if (!stops.length) return null;

    const optimizedStops = data.optimizedStops
      ? normalizeStops(data.optimizedStops)
      : undefined;

    return {
      id:
        typeof data.id === "string" && data.id.trim().length > 0
          ? data.id
          : `itinerary-${Date.now()}`,
      createdAt:
        typeof data.createdAt === "number" && Number.isFinite(data.createdAt)
          ? data.createdAt
          : Date.now(),
      mode: data.mode === "drive" ? "drive" : "walk",
      stops,
      optimizedStops: optimizedStops && optimizedStops.length > 0 ? optimizedStops : undefined,
    } satisfies Itinerary;
  } catch {
    return null;
  }
};
