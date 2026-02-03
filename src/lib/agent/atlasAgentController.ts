import type { RefObject } from "react";
import type { UiIntent } from "@/lib/ai/atlasAssistant.types";
import type { Focus } from "@/lib/types";
import type { GlobeHandle } from "@/components/globe/GlobeGL";

const DEFAULT_FOCUS_DURATION_MS = 1000;

const normalizeCountryCode = (value: string) => value.trim().toUpperCase();

type AtlasAgentControllerDeps = {
  globeRef: RefObject<GlobeHandle | null>;
  resolveCountryFocus: (code: string, source: Focus["source"], nameHint?: string) => Focus | null;
  setFocus: (focus: Focus | null) => void;
  triggerAiOrb?: () => void;
};

export const createAtlasAgentController = (deps: AtlasAgentControllerDeps) => {
  let focusTimeout: ReturnType<typeof setTimeout> | null = null;

  const cancelPendingFocus = () => {
    if (focusTimeout) {
      clearTimeout(focusTimeout);
      focusTimeout = null;
    }
  };

  const focusCountry = (countryCode: string, durationMs = DEFAULT_FOCUS_DURATION_MS) => {
    const normalized = normalizeCountryCode(countryCode);
    if (!normalized) return null;

    const next = deps.resolveCountryFocus(normalized, "ai");
    if (!next) return null;

    cancelPendingFocus();

    deps.triggerAiOrb?.();
    deps.globeRef.current?.highlightCountry(next.code ?? normalized, {
      pulseMs: Math.min(1200, durationMs + 200),
    });
    deps.globeRef.current?.flyToLatLon(next.lat, next.lon, { durationMs });

    focusTimeout = setTimeout(() => {
      deps.setFocus(next);
      focusTimeout = null;
    }, durationMs);

    return next;
  };

  const openCountryPanel = (countryCode: string) => {
    const normalized = normalizeCountryCode(countryCode);
    if (!normalized) return null;
    const next = deps.resolveCountryFocus(normalized, "ai");
    if (!next) return null;
    cancelPendingFocus();
    deps.setFocus(next);
    return next;
  };

  const clearSelection = () => {
    cancelPendingFocus();
    deps.setFocus(null);
  };

  const returnToWorldView = (durationMs = DEFAULT_FOCUS_DURATION_MS) => {
    cancelPendingFocus();
    deps.setFocus(null);
    deps.globeRef.current?.resetView({ durationMs });
  };

  const executeIntents = async (intents: UiIntent[]) => {
    if (!Array.isArray(intents) || intents.length === 0) return;

    const focusIntent = intents.find((intent) => intent.type === "focus_country");
    const focusCode = focusIntent ? normalizeCountryCode(focusIntent.countryCode) : null;

    for (const intent of intents) {
      switch (intent.type) {
        case "focus_country":
          focusCountry(intent.countryCode);
          break;
        case "open_country_panel":
          if (focusCode && normalizeCountryCode(intent.countryCode) === focusCode) {
            break;
          }
          openCountryPanel(intent.countryCode);
          break;
        case "clear_selection":
          clearSelection();
          break;
        case "return_to_world_view":
          returnToWorldView();
          break;
        default:
          break;
      }
    }
  };

  return { executeIntents };
};
