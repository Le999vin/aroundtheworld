type Coordinates = {
  lat: number;
  lon: number;
};

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const haversineKm = (a: Coordinates, b: Coordinates) => {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const haversine =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  const clamped = Math.min(1, Math.sqrt(haversine));
  return 2 * EARTH_RADIUS_KM * Math.asin(clamped);
};

export const sumRouteKm = (points: Coordinates[]) => {
  if (points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineKm(points[index - 1], points[index]);
  }
  return total;
};

export const estimateEtaMinutes = (
  distanceKm: number,
  mode: "walk" | "drive"
) => {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const speedKmh = mode === "drive" ? 45 : 5;
  const minutes = (distanceKm / speedKmh) * 60;
  return Math.max(1, Math.round(minutes));
};
