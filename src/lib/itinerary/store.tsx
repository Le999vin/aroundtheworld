"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Itinerary,
  ItineraryOrigin,
  ItineraryPlanMeta,
  ItineraryScenario,
  ItinerarySettings,
  ItineraryStop,
} from "@/lib/itinerary/types";
import { optimizeGreedy } from "@/lib/itinerary/optimize";
import { haversineKm } from "@/lib/map/distance";

type TravelMode = "walk" | "drive";

type Coordinates = {
  lat: number;
  lon: number;
};

type ItineraryStore = {
  selectedStops: ItineraryStop[];
  optimizedStops: ItineraryStop[] | null;
  mode: TravelMode;
  origin: ItineraryOrigin;
  originCoordinates: Coordinates;
  scenarios: ItineraryScenario[];
  planMeta: ItineraryPlanMeta;
  settings: ItinerarySettings;
  maxStops: number;
  isPlanFull: boolean;
  notice: string | null;
  hydrated: boolean;
  addStop: (stop: ItineraryStop) => void;
  removeStop: (id: string) => void;
  toggleStop: (stop: ItineraryStop) => void;
  reset: () => void;
  setMode: (mode: TravelMode) => void;
  setOriginDevice: () => void;
  refreshDeviceOrigin: () => void;
  setOriginCustom: (lat: number, lon: number, label: string) => void;
  saveScenarioFromCurrentOrigin: (label: string) => void;
  removeScenario: (id: string) => void;
  setPlannedFor: (dateIso?: string) => void;
  setNote: (note: string) => void;
  setRoundTrip: (value: boolean) => void;
  setShareIncludeExactOrigin: (value: boolean) => void;
  createPlan: () => void;
  loadFromShare: (itinerary: Itinerary) => void;
};

const STORAGE_KEY = "gta.itinerary.selected";
const MAX_STOPS = 6;
const DEFAULT_ORIGIN_LABEL = "Mein Standort";
const DEFAULT_CUSTOM_LABEL = "Startpunkt";

type ItineraryProviderProps = {
  children: ReactNode;
  defaultOrigin: Coordinates;
};

const ItineraryContext = createContext<ItineraryStore | null>(null);

const isValidStop = (value: unknown): value is ItineraryStop => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.lat === "number" &&
    typeof record.lon === "number"
  );
};

const normalizeStops = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const stops: ItineraryStop[] = [];
  for (const entry of value) {
    if (!isValidStop(entry)) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    stops.push(entry);
    if (stops.length >= MAX_STOPS) break;
  }
  return stops;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isValidLatLon = (lat: unknown, lon: unknown) =>
  isFiniteNumber(lat) &&
  isFiniteNumber(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;

const normalizeOrigin = (value: unknown): ItineraryOrigin | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const updatedAt = isFiniteNumber(record.updatedAt)
    ? record.updatedAt
    : Date.now();
  if (record.mode === "device") {
    const label =
      typeof record.label === "string" && record.label.trim().length > 0
        ? record.label
        : DEFAULT_ORIGIN_LABEL;
    const hasCoords = isValidLatLon(record.lat, record.lon);
    const accuracy = isFiniteNumber(record.accuracy)
      ? record.accuracy
      : undefined;
    return {
      mode: "device",
      label,
      updatedAt,
      ...(hasCoords
        ? { lat: record.lat as number, lon: record.lon as number }
        : {}),
      ...(accuracy !== undefined ? { accuracy } : {}),
    };
  }
  if (record.mode === "custom") {
    if (!isValidLatLon(record.lat, record.lon)) return null;
    const label =
      typeof record.label === "string" && record.label.trim().length > 0
        ? record.label
        : DEFAULT_CUSTOM_LABEL;
    return {
      mode: "custom",
      label,
      updatedAt,
      lat: record.lat as number,
      lon: record.lon as number,
    };
  }
  return null;
};

const normalizeSettings = (value: unknown): ItinerarySettings | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    roundTrip: record.roundTrip === true,
    shareIncludeExactOrigin: record.shareIncludeExactOrigin === true,
  };
};

const normalizePlanMeta = (value: unknown): ItineraryPlanMeta | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const plannedFor =
    typeof record.plannedFor === "string" && record.plannedFor.trim().length > 0
      ? record.plannedFor
      : undefined;
  const note =
    typeof record.note === "string" && record.note.trim().length > 0
      ? record.note
      : undefined;
  if (!plannedFor && !note) return null;
  return { plannedFor, note };
};

const normalizeScenarios = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const scenarios: ItineraryScenario[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id.trim().length === 0) continue;
    if (seen.has(record.id)) continue;
    if (!isValidLatLon(record.lat, record.lon)) continue;
    const label =
      typeof record.label === "string" && record.label.trim().length > 0
        ? record.label
        : DEFAULT_CUSTOM_LABEL;
    const createdAt = isFiniteNumber(record.createdAt)
      ? record.createdAt
      : Date.now();
    scenarios.push({
      id: record.id,
      label,
      lat: record.lat as number,
      lon: record.lon as number,
      createdAt,
    });
    seen.add(record.id);
  }
  return scenarios;
};

const resolveOriginCoordinates = (
  current: ItineraryOrigin
): Coordinates | null => {
  if (current.mode === "custom") {
    return { lat: current.lat, lon: current.lon };
  }
  if (isValidLatLon(current.lat, current.lon)) {
    return { lat: current.lat as number, lon: current.lon as number };
  }
  return null;
};

const routeDistanceKm = (stops: ItineraryStop[], start?: Coordinates) => {
  if (!stops.length) return 0;
  let total = 0;
  let previous: Coordinates | null = start ?? null;
  for (let index = 0; index < stops.length; index += 1) {
    const current = { lat: stops[index].lat, lon: stops[index].lon };
    if (previous) {
      total += haversineKm(previous, current);
    }
    previous = current;
  }
  return total;
};

const improveWithTwoOpt = (
  stops: ItineraryStop[],
  start?: Coordinates
) => {
  if (stops.length < 3) return stops;
  let best = [...stops];
  let bestDistance = routeDistanceKm(best, start);
  const maxIterations = 6;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let improved = false;
    for (let i = 0; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const candidateDistance = routeDistanceKm(candidate, start);
        if (candidateDistance + 0.01 < bestDistance) {
          best = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
};

export const ItineraryProvider = ({
  children,
  defaultOrigin,
}: ItineraryProviderProps) => {
  const [selectedStops, setSelectedStops] = useState<ItineraryStop[]>([]);
  const [optimizedStops, setOptimizedStops] =
    useState<ItineraryStop[] | null>(null);
  const [mode, setModeState] = useState<TravelMode>("walk");
  const [origin, setOrigin] = useState<ItineraryOrigin>(() => ({
    mode: "device",
    label: DEFAULT_ORIGIN_LABEL,
    updatedAt: Date.now(),
  }));
  const [scenarios, setScenarios] = useState<ItineraryScenario[]>([]);
  const [planMeta, setPlanMeta] = useState<ItineraryPlanMeta>({});
  const [settings, setSettings] = useState<ItinerarySettings>({
    roundTrip: false,
    shareIncludeExactOrigin: false,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const noticeTimeout = useRef<number | null>(null);
  const deviceOriginRequestedRef = useRef(false);
  const fallbackOrigin = useMemo<Coordinates>(() => {
    if (isValidLatLon(defaultOrigin.lat, defaultOrigin.lon)) {
      return { lat: defaultOrigin.lat, lon: defaultOrigin.lon };
    }
    return { lat: 0, lon: 0 };
  }, [defaultOrigin.lat, defaultOrigin.lon]);

  const setTemporaryNotice = useCallback((message: string | null) => {
    setNotice(message);
    if (noticeTimeout.current) {
      window.clearTimeout(noticeTimeout.current);
      noticeTimeout.current = null;
    }
    if (message) {
      noticeTimeout.current = window.setTimeout(() => {
        setNotice(null);
        noticeTimeout.current = null;
      }, 2500);
    }
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          selectedStops?: unknown;
          mode?: TravelMode;
          origin?: unknown;
          scenarios?: unknown;
          planMeta?: unknown;
          settings?: unknown;
        };
        const stops = normalizeStops(parsed.selectedStops);
        if (stops.length > 0) {
          setSelectedStops(stops);
        }
        if (parsed.mode === "drive" || parsed.mode === "walk") {
          setModeState(parsed.mode);
        }
        const parsedOrigin = normalizeOrigin(parsed.origin);
        if (parsedOrigin) {
          setOrigin(parsedOrigin);
        }
        const parsedScenarios = normalizeScenarios(parsed.scenarios);
        if (parsedScenarios.length) {
          setScenarios(parsedScenarios);
        }
        const parsedPlanMeta = normalizePlanMeta(parsed.planMeta);
        if (parsedPlanMeta) {
          setPlanMeta(parsedPlanMeta);
        }
        const parsedSettings = normalizeSettings(parsed.settings);
        if (parsedSettings) {
          setSettings(parsedSettings);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload = JSON.stringify({
      selectedStops,
      mode,
      origin,
      scenarios,
      planMeta,
      settings,
    });
    window.localStorage.setItem(STORAGE_KEY, payload);
  }, [hydrated, mode, origin, planMeta, scenarios, selectedStops, settings]);

  useEffect(() => {
    return () => {
      if (noticeTimeout.current) {
        window.clearTimeout(noticeTimeout.current);
      }
    };
  }, []);

  const originCoordinates = useMemo(
    () => resolveOriginCoordinates(origin) ?? fallbackOrigin,
    [fallbackOrigin, origin]
  );

  const refreshDeviceOrigin = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setTemporaryNotice("Standort nicht verfuegbar.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin((current) => {
          if (current.mode !== "device") return current;
          return {
            mode: "device",
            label: current.label || DEFAULT_ORIGIN_LABEL,
            updatedAt: Date.now(),
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
        });
      },
      () => {
        setTemporaryNotice("Standort nicht verfuegbar.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [setTemporaryNotice]);

  const requestDeviceOriginIfNeeded = useCallback(() => {
    if (deviceOriginRequestedRef.current) return;
    if (origin.mode !== "device") return;
    if (resolveOriginCoordinates(origin)) return;
    deviceOriginRequestedRef.current = true;
    refreshDeviceOrigin();
  }, [origin, refreshDeviceOrigin]);

  const setOriginDevice = useCallback(() => {
    deviceOriginRequestedRef.current = true;
    setOrigin((current) => ({
      mode: "device",
      label: DEFAULT_ORIGIN_LABEL,
      updatedAt: Date.now(),
      ...(current.mode === "device" && resolveOriginCoordinates(current)
        ? {
            lat: current.lat,
            lon: current.lon,
            accuracy: current.accuracy,
          }
        : {}),
    }));
    refreshDeviceOrigin();
  }, [refreshDeviceOrigin]);

  const setOriginCustom = useCallback((lat: number, lon: number, label: string) => {
    if (!isValidLatLon(lat, lon)) return;
    const trimmed = label.trim();
    setOrigin({
      mode: "custom",
      label: trimmed || DEFAULT_CUSTOM_LABEL,
      updatedAt: Date.now(),
      lat,
      lon,
    });
  }, []);

  const saveScenarioFromCurrentOrigin = useCallback(
    (label: string) => {
      const coords = resolveOriginCoordinates(origin);
      if (!coords) return;
      const trimmed = label.trim();
      const scenarioLabel = trimmed || origin.label || DEFAULT_CUSTOM_LABEL;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `scenario-${Date.now()}`;
      setScenarios((current) => [
        { id, label: scenarioLabel, lat: coords.lat, lon: coords.lon, createdAt: Date.now() },
        ...current,
      ]);
    },
    [origin]
  );

  const removeScenario = useCallback((id: string) => {
    setScenarios((current) => current.filter((scenario) => scenario.id !== id));
  }, []);

  const setPlannedFor = useCallback((dateIso?: string) => {
    const trimmed = dateIso?.trim();
    setPlanMeta((current) => ({
      ...current,
      plannedFor: trimmed && trimmed.length > 0 ? trimmed : undefined,
    }));
  }, []);

  const setNote = useCallback((note: string) => {
    const trimmed = note.trim();
    setPlanMeta((current) => ({
      ...current,
      note: trimmed.length > 0 ? trimmed : undefined,
    }));
  }, []);

  const setRoundTrip = useCallback((value: boolean) => {
    setSettings((current) => ({ ...current, roundTrip: value }));
  }, []);

  const setShareIncludeExactOrigin = useCallback((value: boolean) => {
    setSettings((current) => ({ ...current, shareIncludeExactOrigin: value }));
  }, []);

  const addStop = useCallback(
    (stop: ItineraryStop) => {
      let didChange = false;
      setSelectedStops((current) => {
        if (current.some((item) => item.id === stop.id)) return current;
        if (current.length >= MAX_STOPS) {
          setTemporaryNotice(`Maximal ${MAX_STOPS} Orte im Plan.`);
          return current;
        }
        didChange = true;
        return [...current, stop];
      });
      if (didChange) {
        setOptimizedStops(null);
        setTemporaryNotice(null);
        requestDeviceOriginIfNeeded();
      }
    },
    [requestDeviceOriginIfNeeded, setTemporaryNotice]
  );

  const removeStop = useCallback((id: string) => {
    let didChange = false;
    setSelectedStops((current) => {
      const next = current.filter((stop) => stop.id !== id);
      if (next.length !== current.length) {
        didChange = true;
      }
      return next;
    });
    if (didChange) {
      setOptimizedStops(null);
      setTemporaryNotice(null);
    }
  }, [setTemporaryNotice]);

  const toggleStop = useCallback(
    (stop: ItineraryStop) => {
      let didChange = false;
      setSelectedStops((current) => {
        const exists = current.some((item) => item.id === stop.id);
        if (exists) {
          didChange = true;
          return current.filter((item) => item.id !== stop.id);
        }
        if (current.length >= MAX_STOPS) {
          setTemporaryNotice(`Maximal ${MAX_STOPS} Orte im Plan.`);
          return current;
        }
        didChange = true;
        return [...current, stop];
      });
      if (didChange) {
        setOptimizedStops(null);
        setTemporaryNotice(null);
        requestDeviceOriginIfNeeded();
      }
    },
    [requestDeviceOriginIfNeeded, setTemporaryNotice]
  );

  const reset = useCallback(() => {
    setSelectedStops([]);
    setOptimizedStops(null);
    setModeState("walk");
    setOrigin({
      mode: "device",
      label: DEFAULT_ORIGIN_LABEL,
      updatedAt: Date.now(),
    });
    setScenarios([]);
    setPlanMeta({});
    setSettings({ roundTrip: false, shareIncludeExactOrigin: false });
    setTemporaryNotice(null);
    deviceOriginRequestedRef.current = false;
    window.localStorage.removeItem(STORAGE_KEY);
  }, [setTemporaryNotice]);

  const setMode = useCallback((next: TravelMode) => {
    setModeState(next);
  }, []);

  const createPlan = useCallback(() => {
    if (selectedStops.length < 2) return;
    const startCoord = resolveOriginCoordinates(origin) ?? fallbackOrigin;
    let optimized = optimizeGreedy(selectedStops, startCoord);
    if (optimized.length >= 3 && optimized.length <= MAX_STOPS) {
      optimized = improveWithTwoOpt(optimized, startCoord);
    }
    setOptimizedStops(optimized);
  }, [fallbackOrigin, origin, selectedStops]);

  const loadFromShare = useCallback((itinerary: Itinerary) => {
    const stops = normalizeStops(itinerary.stops);
    if (!stops.length) return;
    setSelectedStops(stops);
    setModeState(itinerary.mode === "drive" ? "drive" : "walk");
    setOptimizedStops(
      itinerary.optimizedStops && itinerary.optimizedStops.length
        ? normalizeStops(itinerary.optimizedStops)
        : null
    );
    const sharedOrigin = normalizeOrigin(itinerary.origin);
    setOrigin(
      sharedOrigin ?? {
        mode: "device",
        label: DEFAULT_ORIGIN_LABEL,
        updatedAt: Date.now(),
      }
    );
    const sharedSettings = normalizeSettings(itinerary.settings);
    setSettings(
      sharedSettings ?? { roundTrip: false, shareIncludeExactOrigin: false }
    );
    const sharedPlanMeta = normalizePlanMeta(itinerary.planMeta);
    setPlanMeta(sharedPlanMeta ?? {});
    setTemporaryNotice(null);
  }, [setTemporaryNotice]);

  const value = useMemo<ItineraryStore>(() => {
    const isPlanFull = selectedStops.length >= MAX_STOPS;
    return {
      selectedStops,
      optimizedStops,
      mode,
      origin,
      originCoordinates,
      scenarios,
      planMeta,
      settings,
      maxStops: MAX_STOPS,
      isPlanFull,
      notice,
      hydrated,
      addStop,
      removeStop,
      toggleStop,
      reset,
      setMode,
      setOriginDevice,
      refreshDeviceOrigin,
      setOriginCustom,
      saveScenarioFromCurrentOrigin,
      removeScenario,
      setPlannedFor,
      setNote,
      setRoundTrip,
      setShareIncludeExactOrigin,
      createPlan,
      loadFromShare,
    };
  }, [
    addStop,
    createPlan,
    hydrated,
    loadFromShare,
    mode,
    notice,
    origin,
    originCoordinates,
    optimizedStops,
    planMeta,
    removeStop,
    removeScenario,
    reset,
    saveScenarioFromCurrentOrigin,
    scenarios,
    selectedStops,
    setNote,
    setMode,
    setOriginCustom,
    setOriginDevice,
    setPlannedFor,
    setRoundTrip,
    setShareIncludeExactOrigin,
    settings,
    toggleStop,
    refreshDeviceOrigin,
  ]);

  return (
    <ItineraryContext.Provider value={value}>
      {children}
    </ItineraryContext.Provider>
  );
};

export const useItinerary = () => {
  const context = useContext(ItineraryContext);
  if (!context) {
    throw new Error("useItinerary must be used within ItineraryProvider");
  }
  return context;
};
