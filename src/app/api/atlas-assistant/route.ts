/**
 * Atlas Assistant API (POST /api/atlas-assistant)
 */

import type { AiChatMessage } from "@/lib/ai/types";
import {
  type AgentMode,
  type AtlasAssistantRequestBody,
  type AtlasAssistantResponse,
  type ChatContext,
  type UiIntent,
} from "@/lib/ai/atlasAssistant.types";
import { buildSystemPrompt } from "@/lib/ai/atlasAssistant.prompt";
import { AtlasAssistantSchema } from "@/lib/ai/atlasAssistant.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = AtlasAssistantRequestBody;

type OllamaResponse = {
  message?: { role?: string; content?: unknown };
  response?: unknown;
  content?: unknown;
};

const resolveAgentMode = (value?: AgentMode): AgentMode => {
  if (value === "confirm" || value === "auto") return value;
  return "off";
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeCountryCode = (value: unknown) => {
  if (!isNonEmptyString(value)) return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
};

const normalizeCountryName = (value: unknown) => {
  if (!isNonEmptyString(value)) return null;
  const normalized = value.trim();
  return normalized || null;
};

const extractLegacyContext = (uiState: unknown) => {
  if (!isRecord(uiState)) return null;
  const context = uiState.context;
  if (!isRecord(context)) return null;

  const country = isRecord(context.country) ? context.country : null;
  const mode = context.mode;

  return {
    mode: typeof mode === "string" ? mode : null,
    selectedCountryCode:
      normalizeCountryCode(country?.code) ?? normalizeCountryCode(uiState.selectedCountryCode),
    selectedCountryName: normalizeCountryName(country?.name),
  };
};

const resolveChatContext = (body: IncomingBody | null, agentMode: AgentMode): ChatContext => {
  const direct = isRecord(body?.chatContext) ? body?.chatContext : null;
  const uiState = body?.uiState;
  const legacy = extractLegacyContext(uiState);

  const uiModeCandidate = direct?.uiMode;
  const uiMode =
    uiModeCandidate === "country" || uiModeCandidate === "global"
      ? uiModeCandidate
      : legacy?.mode === "country"
        ? "country"
        : "global";

  const selectedCountryCode =
    normalizeCountryCode(direct?.selectedCountryCode) ??
    legacy?.selectedCountryCode ??
    null;

  const selectedCountryName =
    normalizeCountryName(direct?.selectedCountryName) ??
    legacy?.selectedCountryName ??
    null;

  return {
    uiMode,
    selectedCountryCode,
    selectedCountryName,
    agentMode,
  };
};

const extractContent = (payload: OllamaResponse | null) => {
  if (!payload) return null;
  if (payload.message && payload.message.content !== undefined) {
    return payload.message.content;
  }
  if (payload.response !== undefined) return payload.response;
  if (payload.content !== undefined) return payload.content;
  return null;
};

const buildFallback = (
  message = "Sorry, das hat nicht geklappt. Sag mir ein Land oder eine Region."
): AtlasAssistantResponse => ({
  message_md: message,
  intents: [],
});

const getErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object") return undefined;
  const record = error as { code?: string; cause?: { code?: string } };
  return record.code ?? record.cause?.code;
};

const isOllamaUnavailable = (error: unknown) => {
  const code = getErrorCode(error);
  if (!code) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.includes("ECONNREFUSED") || message.includes("connect ECONNREFUSED");
  }
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "EHOSTUNREACH"
  );
};

const isSameCountryIntent = (intentCode: string, selectedCountryCode: string | null) => {
  const intentNormalized = normalizeCountryCode(intentCode);
  const selectedNormalized = normalizeCountryCode(selectedCountryCode);
  if (!intentNormalized || !selectedNormalized) return false;
  return intentNormalized === selectedNormalized;
};

const filterRedundantCountryIntents = (
  intents: UiIntent[] | undefined,
  chatContext: ChatContext,
  uiState: unknown
) => {
  if (!Array.isArray(intents) || intents.length === 0) return intents;

  const uiStateRecord = isRecord(uiState) ? uiState : null;
  const panelOpen = chatContext.uiMode === "country" || uiStateRecord?.panelOpen === true;
  const selectedCountryCode = chatContext.selectedCountryCode;

  if (!selectedCountryCode) return intents;

  return intents.filter((intent) => {
    if (
      intent.type === "focus_country" &&
      isSameCountryIntent(intent.countryCode, selectedCountryCode)
    ) {
      return false;
    }

    if (
      intent.type === "open_country_panel" &&
      panelOpen &&
      isSameCountryIntent(intent.countryCode, selectedCountryCode)
    ) {
      return false;
    }

    return true;
  });
};

export async function POST(request: Request) {
  let body: IncomingBody | null = null;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    body = null;
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) {
    return Response.json(buildFallback("Sag mir kurz, wohin du moechtest."), { status: 400 });
  }

  const agentMode = resolveAgentMode(body?.agentMode);
  const uiState = isRecord(body?.uiState) ? body.uiState : {};
  const chatContext = resolveChatContext(body, agentMode);

  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
  const upstreamUrl = `${ollamaBaseUrl}/api/chat`;

  const systemMessages: Array<{ role: "system"; content: string }> = [
    { role: "system", content: buildSystemPrompt(chatContext) },
    { role: "system", content: `CHAT_CONTEXT: ${JSON.stringify(chatContext)}` },
    { role: "system", content: `UI_STATE: ${JSON.stringify({ ...uiState, agentMode })}` },
  ];

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [...systemMessages, ...(messages as AiChatMessage[])],
        stream: false,
        format: AtlasAssistantSchema,
      }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      return Response.json(buildFallback(), { status: 502 });
    }

    const payload = (await upstream.json().catch(() => null)) as OllamaResponse | null;
    const content = extractContent(payload);

    let parsed: AtlasAssistantResponse | null = null;

    if (content && typeof content === "object") {
      parsed = content as AtlasAssistantResponse;
    } else if (isNonEmptyString(content)) {
      try {
        parsed = JSON.parse(content) as AtlasAssistantResponse;
      } catch {
        parsed = null;
      }
    }

    if (!parsed || !isNonEmptyString(parsed.message_md)) {
      return Response.json(buildFallback(), { status: 200 });
    }

    parsed.intents = filterRedundantCountryIntents(parsed.intents, chatContext, uiState) ?? [];

    return Response.json(parsed, { status: 200 });
  } catch (error) {
    if (isOllamaUnavailable(error)) {
      return Response.json(
        buildFallback("Ollama laeuft nicht. Starte Ollama und versuch es erneut."),
        { status: 503 }
      );
    }

    return Response.json(buildFallback(), { status: 500 });
  }
}
