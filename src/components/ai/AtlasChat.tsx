"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiChatContext, AiChatMessage } from "@/lib/ai/types";
import type {
  AgentMode,
  AtlasAssistantResponse,
  UiIntent,
} from "@/lib/ai/atlasAssistant.types";
import { atlasAgentStore, useAtlasAgentStore } from "@/lib/state/atlasAgent.store";

type AtlasChatProps = {
  context: AiChatContext;
  threadKey: string;
  variant: "panel" | "sheet";
  onSelectCountry?: (code: string) => void;
  onExecuteIntents?: (intents: UiIntent[]) => void;
  uiState?: Record<string, unknown>;
};

type AssistantQuickReply = NonNullable<AtlasAssistantResponse["quick_replies"]>[number];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  quickReplies?: AssistantQuickReply[];
  intents?: UiIntent[];
};

const createMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const buildStorageKey = (threadKey: string) =>
  `gta.ai.${encodeURIComponent(threadKey || "global")}.v2`;

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.role !== "user" && record.role !== "assistant") return false;
  return typeof record.content === "string";
};

const MAX_STORED_MESSAGES = 60;

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
        const e = entry as { id?: unknown; role: "user" | "assistant"; content: string };
        return {
          id: typeof e.id === "string" ? e.id : createMessageId(),
          role: e.role,
          content: e.content,
        } satisfies ChatMessage;
      })
      .filter((message): message is ChatMessage => Boolean(message));
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
};

const saveStoredMessages = (storageKey: string, messages: ChatMessage[]) => {
  if (typeof window === "undefined") return;
  try {
    const capped = messages.slice(-MAX_STORED_MESSAGES).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }));
    window.localStorage.setItem(storageKey, JSON.stringify(capped));
  } catch {
    // Ignore write errors.
  }
};

const FALLBACK_RESPONSE: AtlasAssistantResponse = {
  message_md: "Sorry, das hat nicht geklappt. Wohin soll ich dich fuehren?",
  quick_replies: [
    { id: "europe", label: "Europa" },
    { id: "beach", label: "Strand" },
    { id: "city", label: "Stadt" },
  ],
  intents: [],
};

const isValidAtlasAssistantResponse = (value: unknown): value is AtlasAssistantResponse => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.message_md !== "string") return false;
  if (record.quick_replies !== undefined && !Array.isArray(record.quick_replies)) return false;
  if (record.intents !== undefined && !Array.isArray(record.intents)) return false;
  return true;
};

const normalizeConfirmInput = (value: string) =>
  value
    .toLowerCase()
    .replace(/[.!?,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const CONFIRM_PHRASES = new Set([
  "ja",
  "ja bitte",
  "ok",
  "okay",
  "okey",
  "ok mach",
  "mach",
  "mach das",
  "mach bitte",
  "gerne",
  "fuehr mich hin",
  "fuehr mich",
  "fuehr mich bitte",
  "fuehr mich dahin",
  "fuehr mich dorthin",
  "führ mich hin",
  "führ mich",
  "führ mich bitte",
  "führ mich dahin",
  "führ mich dorthin",
  "go",
]);

const isConfirmMessage = (value: string) => {
  const normalized = normalizeConfirmInput(value);
  if (!normalized) return false;
  if (CONFIRM_PHRASES.has(normalized)) return true;
  if (normalized.startsWith("ja ") && normalized.split(" ").length <= 3) return true;
  if (normalized.startsWith("ok ") && normalized.split(" ").length <= 3) return true;
  if (normalized.startsWith("okay ") && normalized.split(" ").length <= 3) return true;
  return false;
};

export const AtlasChat = ({
  context,
  threadKey,
  variant,
  onExecuteIntents,
  uiState,
}: AtlasChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const agentMode = useAtlasAgentStore((state) => state.agentMode);
  const pendingIntents = useAtlasAgentStore((state) => state.pendingIntents);
  const pendingMessageId = useAtlasAgentStore((state) => state.pendingMessageId);

  const storageKey = useMemo(() => buildStorageKey(threadKey), [threadKey]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const initializedKeyRef = useRef<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const uiStatePayload = useMemo(
    () => ({ ...(uiState ?? {}), context }),
    [context, uiState]
  );

  useEffect(() => {
    if (initializedKeyRef.current !== storageKey) return;
    saveStoredMessages(storageKey, messages);
  }, [messages, storageKey]);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setInput("");
    const stored = loadStoredMessages(storageKey);
    messagesRef.current = stored;
    initializedKeyRef.current = storageKey;
    setMessages(stored);
    shouldAutoScrollRef.current = true;
    atlasAgentStore.clearPendingIntents();
  }, [storageKey]);

  const updateAutoScrollFlag = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distFromBottom < 120;
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current && !isLoading) return;
    scrollAnchorRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const prompts = useMemo(() => {
    if (context.mode === "country") {
      const name = context.country?.name ?? "diesem Land";
      const cityHint = context.country?.topCities?.[0]?.name;
      return [
        `Highlights und Must-sees in ${name}?`,
        `3-Tage Route für ${name}`,
        cityHint ? `Tagesplan für ${cityHint}` : `Beste Reisezeit für ${name}`,
        "Worauf sollte ich beim Wetter achten?",
      ];
    }
    return [
      "Empfiehl mir ein Land für Natur und Kultur.",
      "Welche Ziele passen für 7 Tage im Frühling?",
      "Gib mir eine Rundreise-Idee in Europa.",
      "Was ist eine gute erste Reise ausserhalb Europas?",
    ];
  }, [context]);

  const fetchAtlasAssistantResponse = useCallback(
    async (outgoingMessages: AiChatMessage[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("/api/atlas-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: outgoingMessages,
            agentMode,
            uiState: uiStatePayload,
          }),
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as AtlasAssistantResponse | null;
        if (response.ok && data && isValidAtlasAssistantResponse(data)) {
          return data;
        }
      } catch {
        // fall back
      }
      return FALLBACK_RESPONSE;
    },
    [agentMode, uiStatePayload]
  );

  const executeIntents = useCallback(
    (intents: UiIntent[]) => {
      if (!Array.isArray(intents) || intents.length === 0) return;
      onExecuteIntents?.(intents);
    },
    [onExecuteIntents]
  );

  const confirmPendingIntents = useCallback(() => {
    if (!pendingIntents?.length) return false;
    executeIntents(pendingIntents);
    atlasAgentStore.clearPendingIntents();
    return true;
  }, [executeIntents, pendingIntents]);

  const declinePendingIntents = useCallback(() => {
    atlasAgentStore.clearPendingIntents();
  }, []);

  const handleSend = useCallback(
    async (
      override?: string,
      options?: {
        skipConfirmCheck?: boolean;
      }
    ) => {
      if (isLoading) return;
      const content = (override ?? input).trim();
      if (!content) return;

      if (!options?.skipConfirmCheck) {
        if (agentMode === "confirm" && pendingIntents?.length && isConfirmMessage(content)) {
          confirmPendingIntents();
        }
      }

      shouldAutoScrollRef.current = true;

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content,
      };

      const nextMessages = [...messagesRef.current, userMessage];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);

      setInput("");
      setIsLoading(true);

      const outgoingMessages: AiChatMessage[] = nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const response = await fetchAtlasAssistantResponse(outgoingMessages);
      const intents = Array.isArray(response.intents) ? response.intents : [];

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: response.message_md,
        quickReplies: response.quick_replies,
        intents,
      };

      const withAssistant = [...messagesRef.current, assistantMessage];
      messagesRef.current = withAssistant;
      setMessages(withAssistant);

      if (intents.length > 0) {
        if (agentMode === "auto") {
          executeIntents(intents);
        } else if (agentMode === "confirm") {
          atlasAgentStore.setPendingIntents(intents, assistantMessage.id);
        }
      }

      setIsLoading(false);
    },
    [
      agentMode,
      confirmPendingIntents,
      executeIntents,
      fetchAtlasAssistantResponse,
      input,
      isLoading,
      pendingIntents,
    ]
  );

  const handleQuickReply = useCallback(
    (reply: AssistantQuickReply) => {
      if (isLoading) return;
      handleSend(reply.label, { skipConfirmCheck: true });
    },
    [handleSend, isLoading]
  );

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setInput("");
    messagesRef.current = [];
    setMessages([]);
    atlasAgentStore.clearPendingIntents();
    if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const promptGridClass =
    variant === "sheet" ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2";

  const modeOptions: Array<{ value: AgentMode; label: string }> = useMemo(
    () => [
      { value: "off", label: "OFF" },
      { value: "confirm", label: "CONFIRM" },
      { value: "auto", label: "AUTO" },
    ],
    []
  );

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
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Atlas Assistant</p>
              <p className="mt-1 text-sm text-slate-200">Frag nach Ideen, Routen oder Highlights.</p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-[10px] uppercase tracking-[0.3em] text-slate-400">
                {modeOptions.map((mode) => {
                  const isActive = agentMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => atlasAgentStore.setAgentMode(mode.value)}
                      className={cn(
                        "rounded-full px-3 py-1 transition",
                        isActive
                          ? "bg-cyan-300/20 text-cyan-50 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Agent Mode
              </span>
            </div>
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

      <div
        ref={scrollContainerRef}
        onScroll={updateAutoScrollFlag}
        className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
      >
        {messages.length === 0 ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Starter Prompts</p>
            <div className={promptGridClass}>
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                  className="min-w-0 w-full h-auto justify-start rounded-xl border-white/10 bg-white/5 px-3 py-2 text-left text-xs leading-snug text-slate-100 whitespace-normal break-words hover:bg-white/10"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div className="min-w-0 max-w-[85%]">
                  <div
                    className={cn(
                      "break-words rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      message.role === "user" ? "bg-cyan-300/20 text-cyan-50" : "bg-white/10 text-slate-100"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                  {message.role === "assistant" && message.quickReplies?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.quickReplies.map((reply) => (
                        <Button
                          key={`${message.id}-${reply.id}`}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuickReply(reply)}
                          disabled={isLoading}
                          className="h-8 rounded-full border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                        >
                          {reply.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {message.role === "assistant" &&
                  agentMode === "confirm" &&
                  pendingMessageId === message.id &&
                  pendingIntents?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => confirmPendingIntents()}
                        className="h-8 rounded-full"
                      >
                        Ja, zeig mir das
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={declinePendingIntents}
                        className="h-8 rounded-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      >
                        Nein
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={scrollAnchorRef} />
      </div>

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
            disabled={isLoading}
            className="w-full resize-none rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
              {isLoading ? "Antwort wird geladen..." : "Enter zum Senden"}
            </p>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleSend()}
              disabled={isLoading || input.trim().length === 0}
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
