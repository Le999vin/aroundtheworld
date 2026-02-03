export type AgentMode = "off" | "confirm" | "auto";

export type UiIntent =
  | { type: "focus_country"; countryCode: string; reason?: string }
  | { type: "open_country_panel"; countryCode: string }
  | { type: "clear_selection" }
  | { type: "return_to_world_view" };

export type AtlasAssistantResponse = {
  message_md: string;
  quick_replies?: Array<{ id: string; label: string; intent?: UiIntent }>;
  intents?: UiIntent[];
};
