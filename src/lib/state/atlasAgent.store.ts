"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { AgentMode, PendingAction, UiIntent } from "@/lib/ai/atlasAssistant.types";

const STORAGE_KEY = "atlas_agent_mode";

type AtlasAgentState = {
  agentMode: AgentMode;
  pendingAction: PendingAction | null;
};

type AtlasAgentStore = AtlasAgentState & {
  setAgentMode: (mode: AgentMode) => void;
  setPendingAction: (intents: UiIntent[] | null, messageId?: string | null) => void;
  clearPendingAction: () => void;
  hydrateFromStorage: () => void;
  // Compatibility aliases for existing callers during refactor.
  setPendingIntents: (intents: UiIntent[] | null, messageId?: string | null) => void;
  clearPendingIntents: () => void;
  readonly pendingIntents: UiIntent[] | null;
  readonly pendingMessageId: string | null;
};

const SERVER_STATE: AtlasAgentState = {
  agentMode: "off",
  pendingAction: null,
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
  ...SERVER_STATE,
};
let storageHydrated = false;

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setState = (next: Partial<AtlasAgentState>) => {
  state = { ...state, ...next };
  emit();
};

const getState = () => state;
const getServerState = () => SERVER_STATE;

const hydrateFromStorage = () => {
  if (storageHydrated || typeof window === "undefined") return;
  storageHydrated = true;
  const storedMode = readStoredMode();
  if (storedMode === state.agentMode) return;
  setState({
    agentMode: storedMode,
    ...(storedMode === "confirm" ? {} : { pendingAction: null }),
  });
};

const setAgentMode = (mode: AgentMode) => {
  setState({
    agentMode: mode,
    ...(mode === "confirm" ? {} : { pendingAction: null }),
  });
  persistMode(mode);
};

const setPendingAction = (intents: UiIntent[] | null, messageId?: string | null) => {
  const normalized = intents && intents.length > 0 ? intents : null;
  setState({
    pendingAction: normalized
      ? {
          intents: normalized,
          messageId: messageId ?? null,
        }
      : null,
  });
};

const clearPendingAction = () => {
  setState({ pendingAction: null });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useAtlasAgentStore = <T>(selector: (state: AtlasAgentState) => T) =>
  {
    useEffect(() => {
      hydrateFromStorage();
    }, []);

    return useSyncExternalStore(
      subscribe,
      () => selector(getState()),
      () => selector(getServerState())
    );
  };

export const atlasAgentStore: AtlasAgentStore = {
  get agentMode() {
    return state.agentMode;
  },
  get pendingAction() {
    return state.pendingAction;
  },
  get pendingIntents() {
    return state.pendingAction?.intents ?? null;
  },
  get pendingMessageId() {
    return state.pendingAction?.messageId ?? null;
  },
  setAgentMode,
  setPendingAction,
  clearPendingAction,
  hydrateFromStorage,
  setPendingIntents: setPendingAction,
  clearPendingIntents: clearPendingAction,
};
