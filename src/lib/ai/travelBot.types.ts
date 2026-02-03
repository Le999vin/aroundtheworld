export type TravelBotQuickReply = {
  id: string;
  label: string;
  action: "select_country" | "select_city" | "ask_followup" | "show_more";
  payload?: Record<string, any>;
};

export type TravelBotState = {
  step: "pick_country" | "pick_city" | "plan_trip";
  country_code?: string;
  city?: string;
};

export type TravelBotResponse = {
  message_md: string;
  quick_replies: TravelBotQuickReply[];
  state: TravelBotState;
};
