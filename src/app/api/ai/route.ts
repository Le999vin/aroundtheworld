import type { AiChatContext, AiChatMessage } from "@/lib/ai/types";
import { validateActions } from "@/lib/ai/actions";
import type { AiAgentMode, AiUiContext } from "@/lib/ai/actions";
import {
  extractTextFromChatCompletionContent,
  extractTextFromChatCompletionPayload,
  isGatewayUnavailable,
  readGatewayErrorMessage,
  requestAiGatewayChatCompletion,
} from "@/lib/ai/gatewayClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = {
  messages: AiChatMessage[];
  context?: AiChatContext;
  threadKey?: string;
  agentMode?: AiAgentMode;
  uiContext?: AiUiContext;
};

type OpenAiStreamChunk = {
  choices?: Array<{
    delta?: { content?: unknown };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
};

const BASE_SYSTEM_PROMPT = [
  "Du bist der Global Travel Atlas Assistant.",
  "Antworte kurz und klar mit 3-6 Bulletpoints plus konkreten naechsten Schritten.",
  "Nutze zuerst gelieferten Kontext (country/weather/flights/topCities).",
  "Wenn Daten fehlen: sage ehrlich, dass es nicht im Kontext ist, und stelle genau 1 Rueckfrage.",
].join("\n");

const ACTION_MARKER = "\n[ACTIONS]\n";

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

const formatSse = (event: string, data: string) => {
  const lines = data.split(/\r?\n/);
  return [`event: ${event}`, ...lines.map((l) => `data: ${l}`), "", ""].join("\n");
};

const buildContextSummary = (context?: AiChatContext) => {
  if (!context) return "Context: none";
  const safe = JSON.stringify(context).slice(0, 1600);
  return `Context:\n${safe}`;
};

const resolveAgentMode = (value?: AiAgentMode): AiAgentMode => {
  if (value === "confirm" || value === "auto") return value;
  return "off";
};

const buildSystemPrompt = (agentMode: AiAgentMode, uiContext?: AiUiContext) => {
  const uiContextSummary = uiContext ? JSON.stringify(uiContext) : "none";
  return [
    BASE_SYSTEM_PROMPT,
    "",
    "Agent Actions:",
    `Agent Mode: ${agentMode}.`,
    "Gib einen [ACTIONS]-Block nur aus, wenn Agent Mode != off und der Nutzer klar bestaetigt (z.B. 'ja', 'ok', 'mach', 'waehle').",
    "Wenn unsicher: stelle eine Rueckfrage statt Actions.",
    "Erlaubte Actions: selectCountry, openCountryPanel, openMapMode, focusCity, addPoiToPlan, buildItinerary, setOrigin.",
    "Nutze ISO-2 Laendercodes wenn sicher. Wenn unsicher: rueckfragen, keine Action.",
    "Format (nur am Ende der Antwort, ohne Markdown):",
    "[ACTIONS]",
    "{\"actions\":[{\"type\":\"selectCountry\",\"code\":\"MA\"}],\"rationale\":\"...\",\"autoExecute\":true}",
    `UI Context: ${uiContextSummary}`,
  ].join("\n");
};

const splitActionsBlock = (fullText: string) => {
  const markerIndex = fullText.indexOf(ACTION_MARKER);
  if (markerIndex === -1) {
    return { text: fullText, actionsJson: null };
  }
  const text = fullText.slice(0, markerIndex);
  const actionsJson = fullText.slice(markerIndex + ACTION_MARKER.length).trim();
  return { text, actionsJson };
};

const parseSseDataBlocks = (eventBlock: string) => {
  const lines = eventBlock.split(/\r?\n/);
  const dataLines = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());
  if (!dataLines.length) return null;
  return dataLines.join("\n");
};

const parseActions = (actionsJson: string | null) => {
  if (!actionsJson) return null;
  return validateActions(
    (() => {
      try {
        return JSON.parse(actionsJson);
      } catch {
        return null;
      }
    })()
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
  const context = body?.context;
  const agentMode = resolveAgentMode(body?.agentMode);
  const uiContext = body?.uiContext;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: string) => controller.enqueue(enc.encode(formatSse(event, data)));

      if (!messages.length) {
        send("error", "No messages provided.");
        controller.close();
        return;
      }

      const contextSummary = buildContextSummary(context);
      const systemPrompt = buildSystemPrompt(agentMode, uiContext);
      const gatewayMessages = [
        { role: "system", content: `${systemPrompt}\n\n${contextSummary}` },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const abort = new AbortController();
      let t: ReturnType<typeof setTimeout> | null = null;
      const resetTimeout = () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => abort.abort(), 45000);
      };
      resetTimeout();

      try {
        const upstream = await requestAiGatewayChatCompletion(
          {
            messages: gatewayMessages,
            stream: true,
          },
          { signal: abort.signal }
        );

        if (!upstream.ok) {
          const message = await readGatewayErrorMessage(upstream);
          send("error", message);
          controller.close();
          return;
        }

        if (!upstream.body) {
          send("error", "AI Gateway response was empty.");
          controller.close();
          return;
        }

        const contentType = upstream.headers.get("content-type") ?? "";
        const isSse = contentType.includes("text/event-stream");

        if (!isSse) {
          const raw = await upstream.text().catch(() => "");
          let fallbackText = "";
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as unknown;
              fallbackText = extractTextFromChatCompletionPayload(parsed);
            } catch {
              fallbackText = raw;
            }
          }
          const { text, actionsJson } = splitActionsBlock(fallbackText);
          if (isNonEmptyString(text)) {
            send("delta", text);
          } else if (!actionsJson) {
            send("error", "AI Gateway response was empty.");
            controller.close();
            return;
          }
          const parsedActions = parseActions(actionsJson);
          if (parsedActions) {
            send("actions", JSON.stringify(parsedActions));
          }
          send("done", "[DONE]");
          controller.close();
          return;
        }

        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let pendingText = "";
        let sentTextLength = 0;
        let actionsDetected = false;
        let finished = false;

        const emitDelta = (value?: string) => {
          if (!isNonEmptyString(value)) return;
          send("delta", value);
          sentTextLength += value.length;
        };

        const handleStreamText = (value?: string) => {
          if (!isNonEmptyString(value)) return;
          fullText += value;
          pendingText += value;

          if (actionsDetected) {
            return;
          }

          const markerIndex = pendingText.indexOf(ACTION_MARKER);
          if (markerIndex !== -1) {
            const safeText = pendingText.slice(0, markerIndex);
            if (safeText) emitDelta(safeText);
            actionsDetected = true;
            pendingText = pendingText.slice(markerIndex);
            return;
          }

          const tailSize = ACTION_MARKER.length - 1;
          if (pendingText.length > tailSize) {
            const safeText = pendingText.slice(0, pendingText.length - tailSize);
            if (safeText) emitDelta(safeText);
            pendingText = pendingText.slice(-tailSize);
          }
        };

        const finalize = () => {
          if (finished) return;
          const { text, actionsJson } = splitActionsBlock(fullText);
          if (text.length > sentTextLength) {
            emitDelta(text.slice(sentTextLength));
          }
          const parsedActions = parseActions(actionsJson);
          if (parsedActions) {
            send("actions", JSON.stringify(parsedActions));
          }
          send("done", "[DONE]");
          controller.close();
          finished = true;
        };

        const handleSseEvent = (eventBlock: string) => {
          const data = parseSseDataBlocks(eventBlock);
          if (!data) return false;

          if (data === "[DONE]") {
            finalize();
            return true;
          }

          let chunk: OpenAiStreamChunk | null = null;
          try {
            chunk = JSON.parse(data) as OpenAiStreamChunk;
          } catch {
            return false;
          }

          const errorMessage = chunk?.error?.message;
          if (isNonEmptyString(errorMessage)) {
            send("error", `AI Gateway error: ${errorMessage}`);
            controller.close();
            finished = true;
            return true;
          }

          const deltaContent = extractTextFromChatCompletionContent(chunk?.choices?.[0]?.delta?.content);
          handleStreamText(deltaContent);
          return false;
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          resetTimeout();
          buffer += dec.decode(value, { stream: true });

          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            if (!block.trim()) continue;
            const shouldStop = handleSseEvent(block);
            if (shouldStop) return;
          }
        }

        if (buffer.trim().length) {
          const shouldStop = handleSseEvent(buffer);
          if (shouldStop) return;
        }

        finalize();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (abort.signal.aborted) {
          send("error", "AI Gateway timeout (keine Daten).");
        } else if (isGatewayUnavailable(e)) {
          send("error", "AI Gateway ist nicht erreichbar. Pruefe AI_GATEWAY_API_KEY und Netzwerk.");
        } else {
          send("error", `AI Gateway request failed: ${msg}`);
        }
        controller.close();
      } finally {
        if (t) clearTimeout(t);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
