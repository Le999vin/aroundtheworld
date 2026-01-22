export type TravelOrigin =
  | {
      mode: "device";
      label: string;
      lat?: number;
      lon?: number;
      accuracy?: number;
      updatedAt: number;
    }
  | {
      mode: "custom";
      label: string;
      lat: number;
      lon: number;
      updatedAt: number;
    };

export type Airport = {
  iata: string;
  name: string;
  city: string;
  countryCode?: string;
  lat: number;
  lon: number;
};
