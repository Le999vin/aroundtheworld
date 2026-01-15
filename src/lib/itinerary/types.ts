export type ItineraryStop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category?: string;
  city?: string;
  countryCode?: string;
};

export type Itinerary = {
  id: string;
  createdAt: number;
  mode: "walk" | "drive";
  stops: ItineraryStop[];
  optimizedStops?: ItineraryStop[];
};
