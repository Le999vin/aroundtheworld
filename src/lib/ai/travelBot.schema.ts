export const TravelBotSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message_md", "quick_replies", "state"],
  properties: {
    message_md: {
      type: "string",
      minLength: 1,
    },
    quick_replies: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "action"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 64 },
          label: { type: "string", minLength: 1, maxLength: 80 },
          action: {
            type: "string",
            enum: ["select_country", "select_city", "ask_followup", "show_more"],
          },
          payload: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    state: {
      type: "object",
      additionalProperties: false,
      required: ["step"],
      properties: {
        step: {
          type: "string",
          enum: ["pick_country", "pick_city", "plan_trip"],
        },
        country_code: { type: "string", minLength: 2, maxLength: 2 },
        city: { type: "string", minLength: 1, maxLength: 80 },
      },
    },
  },
} as const;
