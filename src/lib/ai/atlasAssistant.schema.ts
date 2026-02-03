export const AtlasAssistantSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: ["message_md"],
  properties: {
    message_md: {
      type: "string",
      maxLength: 1200,
    },
    quick_replies: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 64 },
          label: { type: "string", minLength: 1, maxLength: 120 },
          intent: { $ref: "#/$defs/UiIntent" },
        },
      },
    },
    intents: {
      type: "array",
      maxItems: 3,
      items: { $ref: "#/$defs/UiIntent" },
    },
  },
  $defs: {
    UiIntent: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "countryCode"],
          properties: {
            type: { const: "focus_country" },
            countryCode: { type: "string", minLength: 2, maxLength: 3 },
            reason: { type: "string", maxLength: 200 },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "countryCode"],
          properties: {
            type: { const: "open_country_panel" },
            countryCode: { type: "string", minLength: 2, maxLength: 3 },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type"],
          properties: {
            type: { const: "clear_selection" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type"],
          properties: {
            type: { const: "return_to_world_view" },
          },
        },
      ],
    },
  },
} as const;
