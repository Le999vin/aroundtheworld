import type { AiChatContext, AiChatMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBody = {
  messages: AiChatMessage[];
  context?: AiChatContext;
  threadKey?: string;
};

type OllamaChatChunk = {
  message?: { role?: string; content?: string };
  done?: boolean;
  error?: string;
};

const SYSTEM_PROMPT = [
  "Du bist der Global Travel Atlas Assistant.",
  "Antworte kurz und klar mit 3-6 Bulletpoints plus konkreten naechsten Schritten.",
  "Nutze zuerst gelieferten Kontext (country/weather/flights/topCities).",
  "Wenn Daten fehlen: sage ehrlich, dass es nicht im Kontext ist, und stelle genau 1 Rueckfrage.",
].join("\n");

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

export async function POST(request: Request) {
  let body: IncomingBody | null = null;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    body = null;
  }

  const messages = Array.isArray(body?.messages) ? body!.messages : [];
  const context = body?.context;

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
      const ollamaMessages = [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${contextSummary}` },
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

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          send("error", `Ollama upstream failed (${upstream.status}). ${text.slice(0, 200)}`);
          controller.close();
          return;
        }

        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buffer = "";

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

            const delta = chunk?.message?.content;
            if (isNonEmptyString(delta)) {
              send("delta", delta);
            }

            if (chunk?.done) {
              send("done", "[DONE]");
              controller.close();
              return;
            }
          }
        }

        // flush last buffer (optional)
        send("done", "[DONE]");
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (abort.signal.aborted) {
          send("error", "Ollama timeout (keine Daten).");
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
