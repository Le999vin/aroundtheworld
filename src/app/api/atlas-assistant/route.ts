import type { AiChatMessage } from "@/lib/ai/types";
import type { AgentMode, AtlasAssistantResponse } from "@/lib/ai/atlasAssistant.types";
import { ATLAS_ASSISTANT_SYSTEM_PROMPT } from "@/lib/ai/atlasAssistant.prompt";
import { AtlasAssistantSchema } from "@/lib/ai/atlasAssistant.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = {
  messages: AiChatMessage[];
  agentMode?: AgentMode;
  uiState?: unknown;
};

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

export async function POST(request: Request) {
  let body: IncomingBody | null = null;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    body = null;
  }

  const messages = Array.isArray(body?.messages) ? body!.messages : [];
  if (!messages.length) {
    return Response.json(buildFallback("Sag mir kurz, wohin du moechtest."), { status: 400 });
  }

  const agentMode = resolveAgentMode(body?.agentMode);
  const uiState = body?.uiState ?? {};

  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
  const upstreamUrl = `${ollamaBaseUrl}/api/chat`;

  const systemMessages = [
    { role: "system", content: ATLAS_ASSISTANT_SYSTEM_PROMPT },
    {
      role: "system",
      content: `UI_STATE: ${JSON.stringify({ ...uiState, agentMode })}`,
    },
  ];

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [...systemMessages, ...messages],
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

    return Response.json(parsed, { status: 200 });
  } catch (error) {
    if (isOllamaUnavailable(error)) {
      return Response.json(
        buildFallback(
          "Ollama laeuft nicht. Starte Ollama und versuch es erneut."
        ),
        { status: 503 }
      );
    }

    return Response.json(buildFallback(), { status: 500 });
  }
}
