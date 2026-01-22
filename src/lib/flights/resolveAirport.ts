import type { TravelOrigin } from "@/lib/flights/types";
import { haversineKm } from "@/lib/map/distance";
import { AIRPORTS } from "@/lib/flights/airports";

export const nearestAirport = (lat: number, lon: number) => {
  if (!AIRPORTS.length) return null;
  let best = AIRPORTS[0];
  let bestDistance = haversineKm({ lat, lon }, best);
  for (let index = 1; index < AIRPORTS.length; index += 1) {
    const candidate = AIRPORTS[index];
    const distance = haversineKm({ lat, lon }, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best ?? null;
};

export const resolveDeparture = (origin: TravelOrigin) => {
  const fallback = { iata: "ZRH", label: "ZRH (Zurich)" };
  const hasCoords =
    typeof origin.lat === "number" &&
    typeof origin.lon === "number" &&
    Number.isFinite(origin.lat) &&
    Number.isFinite(origin.lon);
  if (!hasCoords) return fallback;
  const airport = nearestAirport(origin.lat as number, origin.lon as number);
  if (!airport) return fallback;
  return { iata: airport.iata, label: `${airport.iata} (${airport.city})` };
};
