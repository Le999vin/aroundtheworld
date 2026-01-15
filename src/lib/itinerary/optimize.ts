import type { ItineraryStop } from "@/lib/itinerary/types";

type Coordinates = {
  lat: number;
  lon: number;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

export const haversineKm = (a: Coordinates, b: Coordinates) => {
  const radiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * radiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};

const findNearestIndex = (stops: ItineraryStop[], point: Coordinates) => {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < stops.length; i += 1) {
    const stop = stops[i];
    const distance = haversineKm(point, { lat: stop.lat, lon: stop.lon });
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
};

export const optimizeGreedy = (
  stops: ItineraryStop[],
  start?: Coordinates
) => {
  if (stops.length <= 1) return [...stops];

  const remaining = [...stops];
  const ordered: ItineraryStop[] = [];

  if (start) {
    const firstIndex = findNearestIndex(remaining, start);
    ordered.push(remaining.splice(firstIndex, 1)[0]);
  } else {
    ordered.push(remaining.shift() as ItineraryStop);
  }

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    const nextIndex = findNearestIndex(remaining, {
      lat: current.lat,
      lon: current.lon,
    });
    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }

  return ordered;
};
