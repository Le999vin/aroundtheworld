import type { ItineraryStop } from "@/lib/itinerary/types";

export const buildGoogleDirectionsUrl = (
  stops: ItineraryStop[],
  mode: "walk" | "drive"
) => {
  if (stops.length < 2) return null;

  const origin = `${stops[0].lat},${stops[0].lon}`;
  const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lon}`;
  const waypoints = stops
    .slice(1, -1)
    .map((stop) => `${stop.lat},${stop.lon}`)
    .join("|");

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: mode === "walk" ? "walking" : "driving",
  });

  if (waypoints) {
    params.set("waypoints", waypoints);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};
