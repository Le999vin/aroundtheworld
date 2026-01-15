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
import type { Itinerary, ItineraryStop } from "@/lib/itinerary/types";
import { optimizeGreedy } from "@/lib/itinerary/optimize";

type TravelMode = "walk" | "drive";

type Coordinates = {
  lat: number;
  lon: number;
};

type ItineraryStore = {
  selectedStops: ItineraryStop[];
  optimizedStops: ItineraryStop[] | null;
  mode: TravelMode;
  maxStops: number;
  isPlanFull: boolean;
  notice: string | null;
  hydrated: boolean;
  addStop: (stop: ItineraryStop) => void;
  removeStop: (id: string) => void;
  toggleStop: (stop: ItineraryStop) => void;
  reset: () => void;
  setMode: (mode: TravelMode) => void;
  createPlan: (mapCenter?: Coordinates) => void;
  loadFromShare: (itinerary: Itinerary) => void;
};

const STORAGE_KEY = "gta.itinerary.selected";
const MAX_STOPS = 6;

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

export const ItineraryProvider = ({ children }: { children: ReactNode }) => {
  const [selectedStops, setSelectedStops] = useState<ItineraryStop[]>([]);
  const [optimizedStops, setOptimizedStops] =
    useState<ItineraryStop[] | null>(null);
  const [mode, setModeState] = useState<TravelMode>("walk");
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const noticeTimeout = useRef<number | null>(null);

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
        };
        const stops = normalizeStops(parsed.selectedStops);
        if (stops.length > 0) {
          setSelectedStops(stops);
        }
        if (parsed.mode === "drive" || parsed.mode === "walk") {
          setModeState(parsed.mode);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload = JSON.stringify({ selectedStops, mode });
    window.localStorage.setItem(STORAGE_KEY, payload);
  }, [hydrated, mode, selectedStops]);

  useEffect(() => {
    return () => {
      if (noticeTimeout.current) {
        window.clearTimeout(noticeTimeout.current);
      }
    };
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
      }
    },
    [setTemporaryNotice]
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
      }
    },
    [setTemporaryNotice]
  );

  const reset = useCallback(() => {
    setSelectedStops([]);
    setOptimizedStops(null);
    setModeState("walk");
    setTemporaryNotice(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, [setTemporaryNotice]);

  const setMode = useCallback((next: TravelMode) => {
    setModeState(next);
  }, []);

  const createPlan = useCallback(
    (mapCenter?: Coordinates) => {
      if (selectedStops.length < 2) return;
      const optimized = optimizeGreedy(selectedStops, mapCenter);
      setOptimizedStops(optimized);
    },
    [selectedStops]
  );

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
    setTemporaryNotice(null);
  }, [setTemporaryNotice]);

  const value = useMemo<ItineraryStore>(() => {
    const isPlanFull = selectedStops.length >= MAX_STOPS;
    return {
      selectedStops,
      optimizedStops,
      mode,
      maxStops: MAX_STOPS,
      isPlanFull,
      notice,
      hydrated,
      addStop,
      removeStop,
      toggleStop,
      reset,
      setMode,
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
    optimizedStops,
    removeStop,
    reset,
    selectedStops,
    setMode,
    toggleStop,
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
