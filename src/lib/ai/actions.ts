export type AiAgentMode = "off" | "confirm" | "auto";

export type AiAction =
  | { type: "selectCountry"; code: string }
  | { type: "openCountryPanel" }
  | { type: "openMapMode" }
  | { type: "focusCity"; name?: string; lat?: number; lon?: number }
  | { type: "addPoiToPlan"; poiId: string }
  | { type: "buildItinerary" }
  | { type: "setOrigin"; label: string; lat: number; lon: number };

export type AiActionEnvelope = {
  actions: AiAction[];
  rationale?: string;
  autoExecute?: boolean;
};

export type AiUiContext = {
  currentCountryCode?: string;
  hasCountrySelected?: boolean;
};

export type AiActionExecutionResult = {
  ok: boolean;
  message?: string;
};

export const ALLOWED_ACTION_TYPES = new Set<AiAction["type"]>([
  "selectCountry",
  "openCountryPanel",
  "openMapMode",
  "focusCity",
  "addPoiToPlan",
  "buildItinerary",
  "setOrigin",
]);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const validateAction = (value: unknown): AiAction | null => {
  if (!isRecord(value)) return null;
  const type = value.type;
  if (typeof type !== "string" || !ALLOWED_ACTION_TYPES.has(type as AiAction["type"])) {
    return null;
  }

  switch (type) {
    case "selectCountry": {
      const code = isNonEmptyString(value.code) ? value.code.trim().toUpperCase() : "";
      if (!code) return null;
      return { type, code };
    }
    case "openCountryPanel":
    case "openMapMode":
    case "buildItinerary":
      return { type };
    case "focusCity": {
      const name = isNonEmptyString(value.name) ? value.name.trim() : undefined;
      const lat = isFiniteNumber(value.lat) ? value.lat : undefined;
      const lon = isFiniteNumber(value.lon) ? value.lon : undefined;
      if ((lat === undefined) !== (lon === undefined)) return null;
      if (!name && lat === undefined) return null;
      return { type, name, lat, lon };
    }
    case "addPoiToPlan": {
      const poiId = isNonEmptyString(value.poiId) ? value.poiId.trim() : "";
      if (!poiId) return null;
      return { type, poiId };
    }
    case "setOrigin": {
      const label = isNonEmptyString(value.label) ? value.label.trim() : "";
      if (!label) return null;
      const lat = value.lat;
      const lon = value.lon;
      if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return null;
      return { type, label, lat, lon };
    }
    default:
      return null;
  }
};

export const validateActions = (envelope: unknown): AiActionEnvelope | null => {
  if (!isRecord(envelope)) return null;
  const actionsRaw = envelope.actions;
  if (!Array.isArray(actionsRaw)) return null;

  const actions = actionsRaw
    .map((action) => validateAction(action))
    .filter((action): action is AiAction => Boolean(action));

  if (!actions.length) return null;

  const rationale = isNonEmptyString(envelope.rationale)
    ? envelope.rationale.trim()
    : undefined;
  const autoExecute = envelope.autoExecute === true;

  return {
    actions,
    rationale,
    autoExecute,
  };
};
