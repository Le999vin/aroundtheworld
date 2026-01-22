import type { ItineraryStop } from "@/lib/itinerary/types";

export const buildGoogleDirectionsUrl = (
  origin: { lat: number; lon: number } | undefined,
  stops: ItineraryStop[],
  mode: "walk" | "drive",
  roundTrip = false
) => {
  if (origin) {
    if (stops.length < 1) return null;
  } else if (stops.length < 2) {
    return null;
  }

  const resolvedOrigin = origin ?? {
    lat: stops[0].lat,
    lon: stops[0].lon,
  };
  const destinationCoord =
    roundTrip && origin
      ? origin
      : { lat: stops[stops.length - 1].lat, lon: stops[stops.length - 1].lon };
  const waypointStops = origin
    ? roundTrip
      ? stops
      : stops.slice(0, -1)
    : stops.slice(1, -1);
  const originValue = `${resolvedOrigin.lat},${resolvedOrigin.lon}`;
  const destinationValue = `${destinationCoord.lat},${destinationCoord.lon}`;
  const waypoints = waypointStops
    .map((stop) => `${stop.lat},${stop.lon}`)
    .join("|");

  const params = new URLSearchParams({
    api: "1",
    origin: originValue,
    destination: destinationValue,
    travelmode: mode === "walk" ? "walking" : "driving",
  });

  if (waypoints) {
    params.set("waypoints", waypoints);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};
