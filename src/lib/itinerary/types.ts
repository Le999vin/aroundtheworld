export type ItineraryStop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category?: string;
  city?: string;
  countryCode?: string;
};

export type ItineraryOrigin =
  | {
      mode: "device";
      label: string;
      updatedAt: number;
      lat?: number;
      lon?: number;
      accuracy?: number;
    }
  | {
      mode: "custom";
      label: string;
      updatedAt: number;
      lat: number;
      lon: number;
    };

export type ItinerarySettings = {
  roundTrip: boolean;
  shareIncludeExactOrigin: boolean;
};

export type ItineraryPlanMeta = {
  plannedFor?: string;
  note?: string;
};

export type ItineraryScenario = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  createdAt: number;
};

export type Itinerary = {
  id: string;
  createdAt: number;
  mode: "walk" | "drive";
  stops: ItineraryStop[];
  optimizedStops?: ItineraryStop[];
  origin?: ItineraryOrigin;
  settings?: ItinerarySettings;
  planMeta?: ItineraryPlanMeta;
};
