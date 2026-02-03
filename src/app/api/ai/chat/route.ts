import type { AiChatMessage } from "@/lib/ai/types";
import { TravelBotSchema } from "@/lib/ai/travelBot.schema";
import { TRAVEL_BOT_SYSTEM_PROMPT } from "@/lib/ai/travelBot.prompt";
import type { TravelBotQuickReply, TravelBotResponse, TravelBotState } from "@/lib/ai/travelBot.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = {
  messages: AiChatMessage[];
  appState?: unknown;
};

type OllamaChatResponse = {
  message?: { content?: string };
  response?: string;
  content?: string;
  error?: string;
};

const FALLBACK_RESPONSE: TravelBotResponse = {
  message_md: "Sorry, das hat nicht geklappt. Was suchst du: Strand oder Stadt?",
  quick_replies: [
    {
      id: "strand",
      label: "Strand",
      action: "ask_followup",
      payload: { topic: "beach" },
    },
    {
      id: "stadt",
      label: "Stadt",
      action: "ask_followup",
      payload: { topic: "city" },
    },
  ],
  state: { step: "pick_country" },
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const buildAppStateSummary = (appState: unknown) => {
  if (appState === undefined) return "APP_STATE: none";
  try {
    const json = JSON.stringify(appState);
    return `APP_STATE: ${json.slice(0, 2000)}`;
  } catch {
    return `APP_STATE: ${String(appState ?? "none")}`;
  }
};

const extractOllamaContent = (data: OllamaChatResponse | null) => {
  if (!data) return "";
  if (isNonEmptyString(data.message?.content)) return data.message!.content!;
  if (isNonEmptyString(data.response)) return data.response;
  if (isNonEmptyString(data.content)) return data.content;
  return "";
};

const extractJsonObject = (text: string) => {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
};

const parseState = (value: unknown): TravelBotState | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const step = record.step;
  if (step !== "pick_country" && step !== "pick_city" && step !== "plan_trip") return null;
  const state: TravelBotState = { step };
  if (isNonEmptyString(record.country_code)) {
    state.country_code = record.country_code.toUpperCase();
  }
  if (isNonEmptyString(record.city)) {
    state.city = record.city;
  }
  return state;
};

const parseQuickReplies = (value: unknown): TravelBotQuickReply[] | null => {
  if (!Array.isArray(value)) return null;
  const result: TravelBotQuickReply[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = record.id;
    const label = record.label;
    const action = record.action;
    if (!isNonEmptyString(id) || !isNonEmptyString(label)) continue;
    if (
      action !== "select_country" &&
      action !== "select_city" &&
      action !== "ask_followup" &&
      action !== "show_more"
    ) {
      continue;
    }
    const payload =
      record.payload && typeof record.payload === "object"
        ? (record.payload as Record<string, any>)
        : undefined;
    result.push({ id, label, action, payload });
    if (result.length >= 6) break;
  }
  return result;
};

const validateTravelBotResponse = (value: unknown): TravelBotResponse | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isNonEmptyString(record.message_md)) return null;
  const quickReplies = parseQuickReplies(record.quick_replies);
  if (!quickReplies) return null;
  const state = parseState(record.state);
  if (!state) return null;
  return {
    message_md: record.message_md,
    quick_replies: quickReplies,
    state,
  };
};

const safeParseResponse = (raw: string): TravelBotResponse | null => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const direct = validateTravelBotResponse(parsed);
  if (direct) return direct;

  const extracted = extractJsonObject(raw);
  if (!extracted) return null;
  try {
    parsed = JSON.parse(extracted);
  } catch {
    parsed = null;
  }
  return validateTravelBotResponse(parsed);
};

export async function POST(request: Request) {
  let body: IncomingBody | null = null;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    body = null;
  }

  const messages = Array.isArray(body?.messages) ? body!.messages : [];
  if (!messages.length) {
    return Response.json(FALLBACK_RESPONSE);
  }

  const ollamaBaseUrl = (process.env.OLLAMA_URL ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(
    /\/+$/,
    ""
  );
  const model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
  const upstreamUrl = `${ollamaBaseUrl}/api/chat`;

  const appStateSummary = buildAppStateSummary(body?.appState);
  const ollamaMessages = [
    { role: "system", content: TRAVEL_BOT_SYSTEM_PROMPT },
    { role: "system", content: appStateSummary },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
  ];

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: false,
        format: TravelBotSchema,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          repeat_penalty: 1.1,
        },
      }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      return Response.json(FALLBACK_RESPONSE);
    }

    const data = (await upstream.json().catch(() => null)) as OllamaChatResponse | null;
    if (!data || data.error) {
      return Response.json(FALLBACK_RESPONSE);
    }

    const rawContent = extractOllamaContent(data);
    if (!rawContent) {
      return Response.json(FALLBACK_RESPONSE);
    }

    const parsed = safeParseResponse(rawContent);
    if (!parsed) {
      return Response.json(FALLBACK_RESPONSE);
    }

    return Response.json(parsed);
  } catch {
    return Response.json(FALLBACK_RESPONSE);
  }
}
