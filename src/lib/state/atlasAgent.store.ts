"use client";

import { useSyncExternalStore } from "react";
import type { AgentMode, UiIntent } from "@/lib/ai/atlasAssistant.types";

const STORAGE_KEY = "atlas_agent_mode";

type AtlasAgentState = {
  agentMode: AgentMode;
  pendingIntents: UiIntent[] | null;
  pendingMessageId: string | null;
};

type AtlasAgentStore = AtlasAgentState & {
  setAgentMode: (mode: AgentMode) => void;
  setPendingIntents: (intents: UiIntent[] | null, messageId?: string | null) => void;
  clearPendingIntents: () => void;
};

const readStoredMode = (): AgentMode => {
  if (typeof window === "undefined") return "off";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "auto" || raw === "confirm" || raw === "off") {
      return raw;
    }
  } catch {
    // ignore
  }
  return "off";
};

const persistMode = (mode: AgentMode) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
};

let state: AtlasAgentState = {
  agentMode: readStoredMode(),
  pendingIntents: null,
  pendingMessageId: null,
};

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setState = (next: Partial<AtlasAgentState>) => {
  state = { ...state, ...next };
  emit();
};

const getState = () => state;

const setAgentMode = (mode: AgentMode) => {
  setState({
    agentMode: mode,
    ...(mode === "confirm" ? {} : { pendingIntents: null, pendingMessageId: null }),
  });
  persistMode(mode);
};

const setPendingIntents = (intents: UiIntent[] | null, messageId?: string | null) => {
  const normalized = intents && intents.length > 0 ? intents : null;
  setState({
    pendingIntents: normalized,
    pendingMessageId: normalized ? messageId ?? null : null,
  });
};

const clearPendingIntents = () => {
  setState({ pendingIntents: null, pendingMessageId: null });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useAtlasAgentStore = <T>(selector: (state: AtlasAgentState) => T) =>
  useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()));

export const atlasAgentStore: AtlasAgentStore = {
  get agentMode() {
    return state.agentMode;
  },
  get pendingIntents() {
    return state.pendingIntents;
  },
  get pendingMessageId() {
    return state.pendingMessageId;
  },
  setAgentMode,
  setPendingIntents,
  clearPendingIntents,
};
