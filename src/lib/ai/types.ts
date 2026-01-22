export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiChatContext = {
  mode: "explore" | "country";
  country?: {
    code?: string;
    name?: string;
    capital?: string;
    topCities?: Array<{ name: string; lat: number; lon: number }>;
  };
  weather?: unknown;
  flights?: {
    departureLabel?: string;
    departureIata?: string;
    destinations?: string[];
  };
};
