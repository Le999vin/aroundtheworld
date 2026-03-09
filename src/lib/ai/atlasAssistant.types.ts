import type { AiChatMessage } from "@/lib/ai/types";

export type AgentMode = "off" | "confirm" | "auto";
export type UiMode = "global" | "country";

export type UiIntent =
  | { type: "focus_country"; countryCode: string; reason?: string }
  | { type: "open_country_panel"; countryCode: string }
  | { type: "clear_selection" }
  | { type: "return_to_world_view" };

export type ChatContext = {
  selectedCountryCode: string | null;
  selectedCountryName: string | null;
  uiMode: UiMode;
  agentMode: AgentMode;
};

export type PendingAction = {
  intents: UiIntent[];
  messageId: string | null;
};

export type AtlasAssistantResponse = {
  message_md: string;
  quick_replies?: Array<{ id: string; label: string; intent?: UiIntent }>;
  intents?: UiIntent[];
};

export type AtlasAssistantRequestBody = {
  messages: AiChatMessage[];
  agentMode?: AgentMode;
  chatContext?: Partial<ChatContext> | null;
  uiState?: unknown;
};
