import type { AiChatContext, AiChatMessage } from "@/lib/ai/types";
import { validateActions } from "@/lib/ai/actions";
import type { AiAgentMode, AiUiContext } from "@/lib/ai/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = {
  messages: AiChatMessage[];
  context?: AiChatContext;
  threadKey?: string;
  agentMode?: AiAgentMode;
  uiContext?: AiUiContext;
};

type OllamaChatChunk = {
  message?: { role?: string; content?: string };
  response?: string;
  done?: boolean;
  error?: string;
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
  // Keep it short, avoid huge JSON
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

const extractOllamaText = (raw: string) => {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as {
      message?: { content?: string };
      response?: string;
      content?: string;
    };
    if (isNonEmptyString(parsed?.message?.content)) return parsed.message.content;
    if (isNonEmptyString(parsed?.response)) return parsed.response;
    if (isNonEmptyString(parsed?.content)) return parsed.content;
  } catch {
    // fall through
  }
  return raw;
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

  const provider = process.env.AI_PROVIDER ?? "ollama";
  if (provider !== "ollama") {
    return new Response("event: error\ndata: AI_PROVIDER ist nicht ollama\n\n", {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }

  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
  const upstreamUrl = `${ollamaBaseUrl}/api/chat`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: string) => controller.enqueue(enc.encode(formatSse(event, data)));

      // Basic validation
      if (!messages.length) {
        send("error", "No messages provided.");
        controller.close();
        return;
      }

      // Build Ollama messages
      const contextSummary = buildContextSummary(context);
      const systemPrompt = buildSystemPrompt(agentMode, uiContext);
      const ollamaMessages = [
        { role: "system", content: `${systemPrompt}\n\n${contextSummary}` },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      // Inactivity timeout (reset when we get chunks)
      const abort = new AbortController();
      let t: ReturnType<typeof setTimeout> | null = null;
      const resetTimeout = () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => abort.abort(), 45000);
      };
      resetTimeout();

      try {
        const upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: ollamaMessages,
            stream: true,
          }),
          signal: abort.signal,
          cache: "no-store",
        });

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          send("error", `Ollama upstream failed (${upstream.status}). ${text.slice(0, 200)}`);
          controller.close();
          return;
        }

        const contentType = upstream.headers.get("content-type") ?? "";
        const isNdjson = contentType.includes("application/x-ndjson");

        if (!upstream.body) {
          send("error", "Ollama response was empty.");
          controller.close();
          return;
        }

        if (!isNdjson) {
          const raw = await upstream.text().catch(() => "");
          const fallbackText = extractOllamaText(raw);
          const { text, actionsJson } = splitActionsBlock(fallbackText);
          if (isNonEmptyString(text)) {
            send("delta", text);
          } else if (!actionsJson) {
            send("error", "Ollama response was empty.");
            controller.close();
            return;
          }
          if (actionsJson) {
            const parsed = validateActions(
              (() => {
                try {
                  return JSON.parse(actionsJson);
                } catch {
                  return null;
                }
              })()
            );
            if (parsed) {
              send("actions", JSON.stringify(parsed));
            }
          }
          send("done", "[DONE]");
          controller.close();
          return;
        }

        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buffer = "";
        let hadDelta = false;
        let fullText = "";
        let pendingText = "";
        let sentTextLength = 0;
        let actionsDetected = false;

        const emitDelta = (value?: string) => {
          if (!isNonEmptyString(value)) return;
          hadDelta = true;
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

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          resetTimeout();
          buffer += dec.decode(value, { stream: true });

          // Ollama streams newline-delimited JSON
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let chunk: OllamaChatChunk | null = null;
            try {
              chunk = JSON.parse(trimmed) as OllamaChatChunk;
            } catch {
              continue;
            }

            if (chunk?.error) {
              send("error", `Ollama error: ${chunk.error}`);
              controller.close();
              return;
            }

            handleStreamText(chunk?.message?.content ?? chunk?.response);

            if (chunk?.done) {
              const { text, actionsJson } = splitActionsBlock(fullText);
              if (text.length > sentTextLength) {
                emitDelta(text.slice(sentTextLength));
              }
              if (actionsJson) {
                const parsed = validateActions(
                  (() => {
                    try {
                      return JSON.parse(actionsJson);
                    } catch {
                      return null;
                    }
                  })()
                );
                if (parsed) {
                  send("actions", JSON.stringify(parsed));
                }
              }
              send("done", "[DONE]");
              controller.close();
              return;
            }
          }
        }

        const trimmed = buffer.trim();
        if (trimmed.length) {
          try {
            const parsed = JSON.parse(trimmed) as OllamaChatChunk;
            handleStreamText(parsed?.message?.content ?? parsed?.response);
          } catch {
            if (!hadDelta) {
              handleStreamText(trimmed);
            }
          }
        }

        const { text, actionsJson } = splitActionsBlock(fullText || pendingText);
        if (text.length > sentTextLength) {
          emitDelta(text.slice(sentTextLength));
        }
        if (actionsJson) {
          const parsed = validateActions(
            (() => {
              try {
                return JSON.parse(actionsJson);
              } catch {
                return null;
              }
            })()
          );
          if (parsed) {
            send("actions", JSON.stringify(parsed));
          }
        }

        send("done", "[DONE]");
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (abort.signal.aborted) {
          send("error", "Ollama timeout (keine Daten).");
        } else if (isOllamaUnavailable(e)) {
          send(
            "error",
            "Ollama laeuft nicht. Starte Ollama und stelle sicher, dass http://127.0.0.1:11434 erreichbar ist."
          );
        } else {
          send("error", `Ollama request failed: ${msg}`);
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
