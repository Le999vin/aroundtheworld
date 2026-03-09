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
import {
  extractTextFromChatCompletionPayload,
  getGatewayErrorCode,
  readGatewayErrorMessage,
  isGatewayUnavailable,
  requestAiGatewayChatCompletion,
} from "@/lib/ai/gatewayClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = AtlasAssistantRequestBody;
const DEBUG_ATLAS_ASSISTANT = process.env.NODE_ENV !== "production";

const logDebug = (stage: string, data?: Record<string, unknown>) => {
  if (!DEBUG_ATLAS_ASSISTANT) return;
  console.info("[atlas-assistant]", stage, data ?? {});
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

const buildFallback = (
  message = "Sorry, das hat nicht geklappt. Sag mir ein Land oder eine Region."
): AtlasAssistantResponse => ({
  message_md: message,
  intents: [],
});

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

  const systemMessages: Array<{ role: "system"; content: string }> = [
    { role: "system", content: buildSystemPrompt(chatContext) },
    { role: "system", content: `CHAT_CONTEXT: ${JSON.stringify(chatContext)}` },
    { role: "system", content: `UI_STATE: ${JSON.stringify({ ...uiState, agentMode })}` },
  ];

  try {
    const upstream = await requestAiGatewayChatCompletion({
      messages: [...systemMessages, ...(messages as AiChatMessage[])],
      stream: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "atlas_assistant_response",
          schema: AtlasAssistantSchema,
        },
      },
    });

    if (!upstream.ok) {
      const upstreamError = await readGatewayErrorMessage(upstream, "Atlas assistant");
      logDebug("upstream-non-ok", {
        status: upstream.status,
        statusText: upstream.statusText,
        error: upstreamError,
        hasApiKey: Boolean(process.env.AI_GATEWAY_API_KEY?.trim()),
      });
      return Response.json(buildFallback(), { status: 502 });
    }

    const payload = (await upstream.json().catch(() => null)) as unknown;
    const content = extractTextFromChatCompletionPayload(payload);

    let parsed: AtlasAssistantResponse | null = null;
    if (isNonEmptyString(content)) {
      try {
        parsed = JSON.parse(content) as AtlasAssistantResponse;
      } catch {
        logDebug("content-json-parse-failed", {
          contentLength: content.length,
        });
        parsed = null;
      }
    }

    if (!parsed || !isNonEmptyString(parsed.message_md)) {
      return Response.json(buildFallback(), { status: 200 });
    }

    parsed.intents = filterRedundantCountryIntents(parsed.intents, chatContext, uiState) ?? [];

    return Response.json(parsed, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    logDebug("route-error", {
      code: getGatewayErrorCode(error) ?? null,
      isGatewayUnavailable: isGatewayUnavailable(error),
      message,
      hasApiKey: Boolean(process.env.AI_GATEWAY_API_KEY?.trim()),
    });
    if (isGatewayUnavailable(error)) {
      return Response.json(
        buildFallback("AI Gateway ist nicht erreichbar. Pruefe AI_GATEWAY_API_KEY und versuch es erneut."),
        { status: 503 }
      );
    }

    return Response.json(buildFallback(), { status: 500 });
  }
}
