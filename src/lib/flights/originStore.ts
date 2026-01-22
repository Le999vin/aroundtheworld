import type { TravelOrigin } from "@/lib/flights/types";

const KEY = "gta.travelOrigin.v1";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isValidLatLon = (lat: unknown, lon: unknown) =>
  isFiniteNumber(lat) &&
  isFiniteNumber(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;

const normalizeOrigin = (value: unknown): TravelOrigin | null => {
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

export function loadOrigin(): TravelOrigin | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return normalizeOrigin(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(KEY);
    return null;
  }
}

export function saveOrigin(origin: TravelOrigin): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(origin));
  } catch {
    // Ignore write errors.
  }
}

export function defaultOrigin(): TravelOrigin {
  return {
    mode: "device",
    label: "Mein Standort",
    updatedAt: Date.now(),
  };
}
