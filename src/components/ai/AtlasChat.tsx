"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiChatContext, AiChatMessage } from "@/lib/ai/types";
import {
  type AiAction,
  type AiActionEnvelope,
  type AiActionExecutionResult,
  type AiAgentMode,
  type AiUiContext,
  validateActions,
} from "@/lib/ai/actions";
import { countryMetaByCode } from "@/lib/countries/countryMeta";

type AtlasChatProps = {
  context: AiChatContext;
  threadKey: string;
  variant: "panel" | "sheet";
  agentMode: AiAgentMode;
  onAgentModeChange?: (mode: AiAgentMode) => void;
  onExecuteActions?: (envelope: AiActionEnvelope) => Promise<AiActionExecutionResult>;
  uiContext?: AiUiContext;
};

type ChatTextMessage = AiChatMessage & {
  id: string;
  kind?: "text";
};

type ActionStatus = "pending" | "executed" | "rejected" | "error";

type ChatActionMessage = {
  id: string;
  kind: "actions";
  envelope: AiActionEnvelope;
  status: ActionStatus;
  statusMessage?: string;
  autoTriggered?: boolean;
};

type ChatMessage = ChatTextMessage | ChatActionMessage;

const isTextMessage = (message: ChatMessage): message is ChatTextMessage =>
  message.kind !== "actions";

const createMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const buildStorageKey = (threadKey: string) =>
  `gta.ai.${encodeURIComponent(threadKey || "global")}.v1`;

const isChatMessage = (value: unknown): value is ChatTextMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.role !== "user" && record.role !== "assistant") return false;
  return typeof record.content === "string";
};

const loadStoredMessages = (storageKey: string): ChatMessage[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!isChatMessage(entry)) return null;
        return {
          id: typeof entry.id === "string" ? entry.id : createMessageId(),
          role: entry.role,
          content: entry.content,
        } satisfies ChatMessage;
      })
      .filter((message): message is ChatMessage => Boolean(message));
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
};

const saveStoredMessages = (storageKey: string, messages: ChatTextMessage[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(messages));
  } catch {
    // Ignore write errors.
  }
};

const getActionLabel = (action: AiAction) => {
  switch (action.type) {
    case "selectCountry": {
      const meta = countryMetaByCode[action.code];
      const label = meta?.name ? `${meta.name} (${action.code})` : action.code;
      return `Land auswaehlen: ${label}`;
    }
    case "openCountryPanel":
      return "Panel oeffnen";
    case "openMapMode":
      return "Map oeffnen";
    case "focusCity":
      if (action.name && action.lat !== undefined && action.lon !== undefined) {
        return `City fokussieren: ${action.name} (${action.lat.toFixed(2)}, ${action.lon.toFixed(2)})`;
      }
      if (action.name) {
        return `City fokussieren: ${action.name}`;
      }
      return "City fokussieren";
    case "addPoiToPlan":
      return `POI zum Plan: ${action.poiId}`;
    case "buildItinerary":
      return "Route erstellen";
    case "setOrigin":
      return `Startpunkt setzen: ${action.label}`;
    default:
      return "Aktion";
  }
};

const AGENT_MODE_LABELS: Record<AiAgentMode, string> = {
  off: "Off",
  confirm: "Confirm",
  auto: "Auto",
};

const AGENT_MODE_OPTIONS: AiAgentMode[] = ["off", "confirm", "auto"];

export const AtlasChat = ({
  context,
  threadKey,
  variant,
  agentMode,
  onAgentModeChange,
  onExecuteActions,
  uiContext,
}: AtlasChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const storageKey = useMemo(() => buildStorageKey(threadKey), [threadKey]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const failedAssistantIdRef = useRef<string | null>(null);
  const initializedKeyRef = useRef<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initializedKeyRef.current !== storageKey) return;
    const storedMessages = messages.filter(
      (message): message is ChatTextMessage => message.kind !== "actions"
    );
    saveStoredMessages(storageKey, storedMessages);
  }, [messages, storageKey]);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    pendingAssistantIdRef.current = null;
    setIsStreaming(false);
    setError(null);
    setInput("");
    const stored = loadStoredMessages(storageKey);
    messagesRef.current = stored;
    initializedKeyRef.current = storageKey;
    setMessages(stored);
  }, [storageKey]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const prompts = useMemo(() => {
    if (context.mode === "country") {
      const name = context.country?.name ?? "diesem Land";
      const cityHint = context.country?.topCities?.[0]?.name;
      return [
        `Highlights und Must-sees in ${name}?`,
        `3-Tage Route fuer ${name}`,
        cityHint ? `Tagesplan fuer ${cityHint}` : `Beste Reisezeit fuer ${name}`,
        "Worauf sollte ich beim Wetter achten?",
      ];
    }
    return [
      "Empfiehl mir ein Land fuer Natur und Kultur.",
      "Welche Ziele passen fuer 7 Tage im Fruehling?",
      "Gib mir eine Rundreise-Idee in Europa.",
      "Was ist eine gute erste Reise ausserhalb Europas?",
    ];
  }, [context]);

  const appendAssistantDelta = useCallback((assistantId: string, delta: string) => {
    setMessages((prev) => {
      const next = prev.map((message) => {
        if (message.id !== assistantId || !isTextMessage(message)) return message;
        return { ...message, content: `${message.content}${delta}` };
      });
      messagesRef.current = next;
      return next;
    });
  }, []);

  const finalizeStream = useCallback(() => {
    abortRef.current = null;
    pendingAssistantIdRef.current = null;
    setIsStreaming(false);
  }, []);

  const updateActionMessage = useCallback(
    (actionId: string, updates: Partial<ChatActionMessage>) => {
      setMessages((prev) => {
        const next = prev.map((message) => {
          if (message.id !== actionId || message.kind !== "actions") return message;
          return { ...message, ...updates };
        });
        messagesRef.current = next;
        return next;
      });
    },
    []
  );

  const executeActionEnvelope = useCallback(
    async (actionId: string, envelope: AiActionEnvelope, autoTriggered = false) => {
      if (!onExecuteActions) {
        updateActionMessage(actionId, {
          status: "error",
          statusMessage: "Keine Aktion-Handler verfuegbar.",
          autoTriggered,
        });
        return;
      }
      updateActionMessage(actionId, {
        status: "pending",
        statusMessage: autoTriggered ? "Wird ausgefuehrt..." : undefined,
        autoTriggered,
      });
      try {
        const result = await onExecuteActions(envelope);
        updateActionMessage(actionId, {
          status: result.ok ? "executed" : "error",
          statusMessage: result.message,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen.";
        updateActionMessage(actionId, { status: "error", statusMessage: message });
      }
    },
    [onExecuteActions, updateActionMessage]
  );

  const streamResponse = useCallback(
    async (
      payload: {
        messages: AiChatMessage[];
        context: AiChatContext;
        threadKey: string;
        agentMode: AiAgentMode;
        uiContext?: AiUiContext;
      },
      assistantId: string
    ) => {
      abortRef.current?.abort();
      failedAssistantIdRef.current = null;
      const controller = new AbortController();
      abortRef.current = controller;
      let doneReceived = false;
      let hadError = false;
      let hadAssistantText = false;

      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/event-stream")) {
          const bodyText = await response.text().catch(() => "");
          console.warn("[atlas-chat] unexpected content-type", {
            status: response.status,
            contentType,
            body: bodyText.slice(0, 400),
          });
          setError("Unexpected response type (expected text/event-stream).");
          failedAssistantIdRef.current = assistantId;
          hadError = true;
          setMessages((prev) => {
            const next = prev.filter(
              (message) =>
                !(
                  message.id === assistantId &&
                  isTextMessage(message) &&
                  message.content.trim().length === 0
                )
            );
            messagesRef.current = next;
            return next;
          });
          return;
        }

        if (!response.body) {
          throw new Error(response.ok ? "Antwort ohne Daten." : "Anfrage fehlgeschlagen.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEventBlock = (block: string) => {
          const lines = block.split(/\r?\n/);
          let eventName = "";
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.startsWith("data: ") ? line.slice(6) : line.slice(5));
            }
          }
          const data = dataLines.join("\n");
          if (!data) return;

          switch (eventName) {
            case "delta":
              hadAssistantText = true;
              appendAssistantDelta(assistantId, data);
              break;
            case "actions": {
              let parsed: AiActionEnvelope | null = null;
              try {
                parsed = validateActions(JSON.parse(data));
              } catch {
                parsed = null;
              }
              if (!parsed) break;
              if (!hadAssistantText) {
                setMessages((prev) => {
                  const next = prev.filter(
                    (message) =>
                      !(
                        message.id === assistantId &&
                        isTextMessage(message) &&
                        message.content.trim().length === 0
                      )
                  );
                  messagesRef.current = next;
                  return next;
                });
              }
              const actionId = createMessageId();
              const actionMessage: ChatActionMessage = {
                id: actionId,
                kind: "actions",
                envelope: parsed,
                status: "pending",
                autoTriggered: false,
              };
              setMessages((prev) => {
                const next = [...prev, actionMessage];
                messagesRef.current = next;
                return next;
              });
              if (agentMode === "auto" && parsed.autoExecute) {
                executeActionEnvelope(actionId, parsed, true);
              }
              break;
            }
            case "error":
              setError(data || "Antwort konnte nicht geladen werden.");
              failedAssistantIdRef.current = assistantId;
              hadError = true;
              setMessages((prev) => {
                const next = prev.filter(
                  (message) =>
                    !(
                      message.id === assistantId &&
                      isTextMessage(message) &&
                      message.content.trim().length === 0
                    )
                );
                messagesRef.current = next;
                return next;
              });
              doneReceived = true;
              break;
            case "done":
              doneReceived = true;
              break;
            default:
              hadAssistantText = true;
              appendAssistantDelta(assistantId, data);
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done || doneReceived) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            handleEventBlock(part);
            if (doneReceived) break;
          }
        }

        if (!doneReceived && buffer.trim().length) {
          handleEventBlock(buffer);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "Antwort konnte nicht geladen werden.";
          setError(message);
          failedAssistantIdRef.current = assistantId;
          hadError = true;
        }
      } finally {
        if (controller.signal.aborted) return;
        finalizeStream();
        if (!hadError) {
          failedAssistantIdRef.current = null;
        }
      }
    },
    [agentMode, appendAssistantDelta, executeActionEnvelope, finalizeStream]
  );

  const handleSend = useCallback(
    async (override?: string) => {
      if (isStreaming) return;
      const content = (override ?? input).trim();
      if (!content) return;

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content,
      };
      const assistantId = createMessageId();
      const assistantMessage: ChatTextMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      const outgoingMessages: AiChatMessage[] = [
        ...messagesRef.current,
        userMessage,
      ]
        .filter((message): message is ChatTextMessage => isTextMessage(message))
        .map(({ role, content: messageContent }) => ({ role, content: messageContent }));

      const nextMessages = [...messagesRef.current, userMessage, assistantMessage];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setInput("");
      setError(null);
      pendingAssistantIdRef.current = assistantId;
      setIsStreaming(true);

      await streamResponse(
        { messages: outgoingMessages, context, threadKey, agentMode, uiContext },
        assistantId
      );
    },
    [agentMode, context, input, isStreaming, streamResponse, threadKey, uiContext]
  );

  const handleRetry = useCallback(() => {
    if (isStreaming) return;
    const failedId = failedAssistantIdRef.current ?? pendingAssistantIdRef.current;
    const baseMessages = failedId
      ? messagesRef.current.filter((message) => message.id !== failedId)
      : messagesRef.current;
    const hasUserMessage = baseMessages.some(
      (message) => isTextMessage(message) && message.role === "user"
    );
    if (!hasUserMessage) return;

    const assistantId = createMessageId();
    const assistantMessage: ChatTextMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };
    const outgoingMessages: AiChatMessage[] = baseMessages
      .filter((message): message is ChatTextMessage => isTextMessage(message))
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const nextMessages = [...baseMessages, assistantMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setError(null);
    pendingAssistantIdRef.current = assistantId;
    failedAssistantIdRef.current = null;
    setIsStreaming(true);
    streamResponse(
      { messages: outgoingMessages, context, threadKey, agentMode, uiContext },
      assistantId
    );
  }, [agentMode, context, isStreaming, streamResponse, threadKey, uiContext]);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    pendingAssistantIdRef.current = null;
    failedAssistantIdRef.current = null;
    setIsStreaming(false);
    setError(null);
    setInput("");
    messagesRef.current = [];
    setMessages([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 gap-3",
          variant === "panel" ? "items-start justify-between" : "items-center justify-end"
        )}
      >
        {variant === "panel" ? (
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
              Atlas Assistant
            </p>
            <p className="mt-1 text-sm text-slate-200">
              Frag nach Ideen, Routen oder Highlights.
            </p>
          </div>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleClear}
          className="text-slate-300 hover:bg-white/10"
        >
          Clear
        </Button>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
          Agent Mode
        </p>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {AGENT_MODE_OPTIONS.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onAgentModeChange?.(mode)}
              disabled={!onAgentModeChange}
              className={cn(
                "rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition",
                !onAgentModeChange ? "cursor-not-allowed opacity-60" : "hover:text-slate-200",
                agentMode === mode
                  ? "bg-cyan-300/20 text-cyan-100"
                  : "text-slate-400"
              )}
            >
              {AGENT_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
        {messages.length === 0 ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Starter Prompts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleSend(prompt)}
                  disabled={isStreaming}
                  className="min-w-0 w-full h-auto justify-start rounded-xl border-white/10 bg-white/5 px-3 py-2 text-left text-xs leading-snug text-slate-100 whitespace-normal break-words hover:bg-white/5"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              if (message.kind === "actions") {
                const showConfirmButtons =
                  agentMode !== "off" &&
                  message.status === "pending" &&
                  !message.autoTriggered;
                const statusText =
                  message.status === "executed"
                    ? "Ausgefuehrt ✓"
                    : message.status === "rejected"
                      ? "Abgelehnt"
                      : message.status === "error"
                        ? message.statusMessage ?? "Aktion fehlgeschlagen"
                        : message.autoTriggered
                          ? message.statusMessage ?? "Wird ausgefuehrt..."
                          : agentMode === "off"
                            ? "Agent Mode aus"
                            : "Bestaetigung erforderlich";
                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="min-w-0 max-w-[90%] space-y-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
                          Vorschlag
                        </p>
                        <span className="text-xs text-slate-400">{statusText}</span>
                      </div>
                      {message.envelope.rationale ? (
                        <p className="text-xs text-slate-300">
                          {message.envelope.rationale}
                        </p>
                      ) : null}
                      <ul className="space-y-1 text-xs text-slate-200">
                        {message.envelope.actions.map((action, index) => (
                          <li key={`${message.id}-action-${index}`}>
                            {getActionLabel(action)}
                          </li>
                        ))}
                      </ul>
                      {message.statusMessage ? (
                        <p className="text-xs text-slate-400">
                          {message.statusMessage}
                        </p>
                      ) : null}
                      {showConfirmButtons ? (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => executeActionEnvelope(message.id, message.envelope)}
                          >
                            Ausfuehren
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateActionMessage(message.id, {
                                status: "rejected",
                                statusMessage: "Abgelehnt",
                              })
                            }
                            className="text-slate-300 hover:bg-white/10"
                          >
                            Ablehnen
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "min-w-0 max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-cyan-300/20 text-cyan-50"
                        : "bg-white/10 text-slate-100"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={scrollAnchorRef} />
      </div>

      {error ? (
        <div className="mt-3 shrink-0 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <p>{error}</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleRetry}
            className="mt-2 h-7 px-2 text-rose-100 hover:bg-rose-500/20"
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="mt-4 shrink-0 border-t border-white/10 pt-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
          <textarea
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Frag den Atlas Assistant..."
            disabled={isStreaming}
            className="w-full resize-none rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
              {isStreaming ? "Antwort wird geladen..." : "Enter zum Senden"}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleSend()}
              disabled={isStreaming || input.trim().length === 0}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AtlasChat;
