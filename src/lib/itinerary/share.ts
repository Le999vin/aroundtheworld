import type {
  Itinerary,
  ItineraryOrigin,
  ItineraryPlanMeta,
  ItinerarySettings,
  ItineraryStop,
} from "@/lib/itinerary/types";

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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isValidLatLon = (lat: unknown, lon: unknown) =>
  isFiniteNumber(lat) &&
  isFiniteNumber(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;

const normalizeOrigin = (value: unknown): ItineraryOrigin | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const updatedAt = isFiniteNumber(record.updatedAt)
    ? record.updatedAt
    : Date.now();
  if (record.mode === "device") {
    const label =
      typeof record.label === "string" && record.label.trim().length > 0
        ? record.label
        : "Mein Standort";
    const hasCoords = isValidLatLon(record.lat, record.lon);
    const accuracy = isFiniteNumber(record.accuracy)
      ? record.accuracy
      : undefined;
    return {
      mode: "device",
      label,
      updatedAt,
      ...(hasCoords
        ? { lat: record.lat as number, lon: record.lon as number }
        : {}),
      ...(accuracy !== undefined ? { accuracy } : {}),
    };
  }
  if (record.mode === "custom") {
    if (!isValidLatLon(record.lat, record.lon)) return null;
    const label =
      typeof record.label === "string" && record.label.trim().length > 0
        ? record.label
        : "Startpunkt";
    return {
      mode: "custom",
      label,
      updatedAt,
      lat: record.lat as number,
      lon: record.lon as number,
    };
  }
  return null;
};

const normalizeSettings = (value: unknown): ItinerarySettings | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    roundTrip: record.roundTrip === true,
    shareIncludeExactOrigin: record.shareIncludeExactOrigin === true,
  };
};

const normalizePlanMeta = (value: unknown): ItineraryPlanMeta | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const plannedFor =
    typeof record.plannedFor === "string" && record.plannedFor.trim().length > 0
      ? record.plannedFor
      : undefined;
  const note =
    typeof record.note === "string" && record.note.trim().length > 0
      ? record.note
      : undefined;
  if (!plannedFor && !note) return null;
  return { plannedFor, note };
};

export const encodeItinerary = (itinerary: Itinerary) => {
  if (typeof window === "undefined") return null;
  try {
    type ShareOrigin = ItineraryOrigin | { mode: "device"; label: string };
    const shareOrigin: ShareOrigin | undefined = itinerary.origin
      ? itinerary.origin.mode === "device" &&
        itinerary.settings?.shareIncludeExactOrigin !== true
        ? {
            mode: "device",
            label: itinerary.origin.label || "Mein Standort",
          }
        : itinerary.origin
      : undefined;
    const payload: Omit<Itinerary, "origin"> & { origin?: ShareOrigin } = {
      ...itinerary,
      origin: shareOrigin,
      settings: itinerary.settings,
      planMeta: itinerary.planMeta,
    };
    const json = JSON.stringify(payload);
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
    const origin = normalizeOrigin(data.origin);
    const settings = normalizeSettings(data.settings);
    const planMeta = normalizePlanMeta(data.planMeta);

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
      optimizedStops:
        optimizedStops && optimizedStops.length > 0 ? optimizedStops : undefined,
      origin: origin ?? undefined,
      settings: settings ?? undefined,
      planMeta: planMeta ?? undefined,
    } satisfies Itinerary;
  } catch {
    return null;
  }
};
