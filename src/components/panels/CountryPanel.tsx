// rechte/untere Info-Karte mit Wetter + Places
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { AtlasChat } from "@/components/ai/AtlasChat";
import { ChatFab } from "@/components/ai/ChatFab";
import { ChatSheet } from "@/components/ai/ChatSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AIRPORTS } from "@/lib/flights/airports";
import { buildGoogleFlightsUrl } from "@/lib/flights/links";
import { requestDeviceLocation } from "@/lib/flights/location";
import { resolveDeparture } from "@/lib/flights/resolveAirport";
import {
  defaultOrigin,
  loadOrigin,
  saveOrigin,
} from "@/lib/flights/originStore";
import type { TravelOrigin } from "@/lib/flights/types";
import type { AiChatContext } from "@/lib/ai/types";
import type {
  AiActionEnvelope,
  AiActionExecutionResult,
  AiAgentMode,
  AiUiContext,
} from "@/lib/ai/actions";
import type {
  Country,
  Focus,
  GeocodeResult,
  POI,
  WeatherData,
} from "@/lib/types";

const formatPopulation = (value?: number) => {
  if (!value) return "-";
  return new Intl.NumberFormat("de-DE").format(value);
};

const weatherIconUrl = (icon: string) =>
  `https://openweathermap.org/img/wn/${icon}@2x.png`;

const roundCoordinate = (value: number) => Math.round(value * 10000) / 10000;

const isValidLatLon = (lat?: number, lon?: number) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat as number) > 90 || Math.abs(lon as number) > 180) {
    return false;
  }
  return true;
};

const isZeroCenter = (lat: number, lon: number) =>
  Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001;

type CountryPanelProps = {
  country: Country | null;
  focus: Focus | null;
  agentMode: AiAgentMode;
  onAgentModeChange?: (mode: AiAgentMode) => void;
  onExecuteActions?: (envelope: AiActionEnvelope) => Promise<AiActionExecutionResult>;
  uiContext?: AiUiContext;
};

type LoadState<T> = {
  key: string;
  data: T | null;
  error: string | null;
};

const useCountryWeather = (focus: Focus | null) => {
  const [state, setState] = useState<LoadState<WeatherData> | null>(null);
  const lat = focus?.lat;
  const lon = focus?.lon;
  const roundedLat = Number.isFinite(lat)
    ? roundCoordinate(lat as number)
    : undefined;
  const roundedLon = Number.isFinite(lon)
    ? roundCoordinate(lon as number)
    : undefined;
  const key =
    roundedLat !== undefined && roundedLon !== undefined
      ? `${roundedLat}:${roundedLon}`
      : null;

  useEffect(() => {
    if (roundedLat === undefined || roundedLon === undefined || !key) return;
    if (!isValidLatLon(roundedLat, roundedLon) || isZeroCenter(roundedLat, roundedLon)) {
      setState({ key, data: null, error: "Weather unavailable" });
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      const url = `/api/weather?lat=${roundedLat}&lon=${roundedLon}`;
      if (process.env.NODE_ENV !== "production") {
        console.debug("[weather] request", { url, key });
      }

      fetch(url, {
        signal: controller.signal,
      })
        .then(async (res) => {
          let payload: unknown = null;
          try {
            payload = await res.json();
          } catch {
            payload = null;
          }
          if (!res.ok) {
            const errorPayload = payload as { error?: string } | null;
            if (process.env.NODE_ENV !== "production") {
              console.warn("[weather] request failed", {
                status: res.status,
                payload,
              });
            }
            throw new Error(errorPayload?.error || "Weather unavailable");
          }
          return payload as WeatherData;
        })
        .then((data: WeatherData) => {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[weather] response", {
              provider: data.provider,
              location: data.location,
              tempC: data.current?.tempC,
              errors: data.errors,
            });
          }
          setState({ key, data, error: null });
        })
        .catch((error: Error) => {
          if (controller.signal.aborted) return;
          setState({ key, data: null, error: error.message });
        });
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [key, roundedLat, roundedLon]);

  return {
    data: state?.key === key ? state.data : null,
    error: state?.key === key ? state.error : null,
    loading: Boolean(key && state?.key !== key),
  };
};

const useCountryPlaces = (country: Country | null, focus: Focus | null) => {
  const [state, setState] = useState<LoadState<POI[]> | null>(null);
  const lat = focus?.lat;
  const lon = focus?.lon;
  const roundedLat = Number.isFinite(lat)
    ? roundCoordinate(lat as number)
    : undefined;
  const roundedLon = Number.isFinite(lon)
    ? roundCoordinate(lon as number)
    : undefined;
  const focusKey = focus
    ? `${focus.kind}:${focus.code ?? "na"}:${focus.name}:${roundedLat ?? "na"}:${roundedLon ?? "na"}`
    : null;
  const key =
    focusKey ??
    (country?.code
      ? `${country.code}:${roundedLat ?? "na"}:${roundedLon ?? "na"}`
      : null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();

    const load = async () => {
      const params = new URLSearchParams({ limit: "8" });
      if (focus?.kind === "city" && focus.name) {
        params.set("city", focus.name);
      } else if (focus?.code || country?.code) {
        params.set("country", focus?.code ?? country?.code ?? "");
      }
      if (
        roundedLat !== undefined &&
        roundedLon !== undefined &&
        isValidLatLon(roundedLat, roundedLon) &&
        !isZeroCenter(roundedLat, roundedLon)
      ) {
        params.set("lat", roundedLat.toString());
        params.set("lon", roundedLon.toString());
      }
      const res = await fetch(`/api/pois?${params.toString()}`, {
        signal: controller.signal,
      });
      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const errorPayload = payload as { error?: string } | null;
        throw new Error(errorPayload?.error || "Places unavailable");
      }

      if (!Array.isArray(payload)) {
        throw new Error("Places unavailable");
      }

      setState({ key, data: payload as POI[], error: null });
    };

    load().catch((error: Error) => {
      if (controller.signal.aborted) return;
      setState({ key, data: null, error: error.message });
    });

    return () => controller.abort();
  }, [key, country?.code, focus, roundedLat, roundedLon]);

  return {
    data: state?.key === key ? state.data : null,
    error: state?.key === key ? state.error : null,
    loading: Boolean(key && state?.key !== key),
  };
};

export const CountryPanel = ({
  country,
  focus,
  agentMode,
  onAgentModeChange,
  onExecuteActions,
  uiContext,
}: CountryPanelProps) => {
  const reduceMotion = useReducedMotion();
  const weatherState = useCountryWeather(focus);
  const placesState = useCountryPlaces(country, focus);
  const [origin, setOrigin] = useState<TravelOrigin>(() => loadOrigin() ?? defaultOrigin());
  const [originStatus, setOriginStatus] = useState<"idle" | "loading" | "error">("idle");
  const [originHint, setOriginHint] = useState<string | null>(null);
  const [isOriginSheetOpen, setIsOriginSheetOpen] = useState(false);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "loading" | "error">("idle");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [airportSelection, setAirportSelection] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const deviceAttemptedRef = useRef(false);

  const poiCards = useMemo<POI[]>(
    () => placesState.data?.slice(0, 5) ?? [],
    [placesState.data]
  );

  const placesLabel = useMemo(() => {
    if (!placesState.data?.length) return null;
    return placesState.data.some((poi) => poi.cityId) ? "Local" : "Curated";
  }, [placesState.data]);

  const originHasCoords = useMemo(
    () => isValidLatLon(origin.lat, origin.lon),
    [origin.lat, origin.lon]
  );

  const departure = useMemo(() => resolveDeparture(origin), [origin]);

  const destinations = useMemo(() => {
    if (!country || !focus) return [];
    const candidates: string[] = [];
    if (focus.kind === "city" && focus.name) {
      candidates.push(focus.name);
    }
    if (country.capital) {
      candidates.push(country.capital);
    }
    if (country.topCities?.length) {
      candidates.push(...country.topCities.map((city) => city.name));
    }
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const name of candidates) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(trimmed);
      if (unique.length >= 6) break;
    }
    return unique;
  }, [country, focus]);

  const threadKey = useMemo(
    () => country?.code || country?.name || "global",
    [country]
  );

  const aiContext = useMemo<AiChatContext>(() => {
    if (!country) {
      return { mode: "explore" };
    }
    return {
      mode: "country",
      country: {
        code: country.code,
        name: country.name,
        capital: country.capital,
        topCities: country.topCities?.slice(0, 6),
      },
      weather: weatherState.data ?? null,
      flights: {
        departureLabel: departure.label,
        departureIata: departure.iata,
        destinations,
      },
    };
  }, [country, departure.iata, departure.label, destinations, weatherState.data]);

  const showGeocodeEmpty =
    geocodeQuery.trim().length >= 2 &&
    geocodeStatus === "idle" &&
    geocodeResults.length === 0;

  const attemptDeviceLocation = useCallback(async (force = false) => {
    if (!force && deviceAttemptedRef.current) return;
    deviceAttemptedRef.current = true;
    setOriginStatus("loading");
    setOriginHint(null);
    try {
      const coords = await requestDeviceLocation();
      const nextOrigin: TravelOrigin = {
        mode: "device",
        label: "Mein Standort",
        lat: coords.lat,
        lon: coords.lon,
        accuracy: coords.accuracy,
        updatedAt: Date.now(),
      };
      setOrigin(nextOrigin);
      saveOrigin(nextOrigin);
      setOriginStatus("idle");
    } catch {
      setOriginStatus("error");
      setOriginHint("Standort nicht verfuegbar - Standard: ZRH (aenderbar)");
    }
  }, []);

  const applyCustomOrigin = useCallback((nextOrigin: TravelOrigin) => {
    setOrigin(nextOrigin);
    saveOrigin(nextOrigin);
    setOriginStatus("idle");
    setOriginHint(null);
  }, []);

  const handleUseDeviceOrigin = useCallback(() => {
    const nextOrigin: TravelOrigin = {
      mode: "device",
      label: "Mein Standort",
      updatedAt: Date.now(),
    };
    setOrigin(nextOrigin);
    saveOrigin(nextOrigin);
    setOriginStatus("idle");
    setOriginHint(null);
    deviceAttemptedRef.current = false;
    attemptDeviceLocation(true);
    setIsOriginSheetOpen(false);
  }, [attemptDeviceLocation]);

  const handleGeocodeSearch = useCallback(async () => {
    const query = geocodeQuery.trim();
    if (query.length < 2) {
      setGeocodeResults([]);
      setGeocodeStatus("idle");
      return;
    }
    setGeocodeStatus("loading");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Geocode failed");
      const data = (await response.json()) as GeocodeResult[];
      setGeocodeResults(Array.isArray(data) ? data : []);
      setGeocodeStatus("idle");
    } catch {
      setGeocodeResults([]);
      setGeocodeStatus("error");
    }
  }, [geocodeQuery]);

  const handleSelectGeocodeResult = useCallback(
    (result: GeocodeResult) => {
      const label = result.country
        ? `${result.name}, ${result.country}`
        : result.name;
      const nextOrigin: TravelOrigin = {
        mode: "custom",
        label,
        lat: result.lat,
        lon: result.lon,
        updatedAt: Date.now(),
      };
      applyCustomOrigin(nextOrigin);
      setGeocodeResults([]);
      setGeocodeStatus("idle");
      setGeocodeQuery(label);
      setAirportSelection("");
      setIsOriginSheetOpen(false);
    },
    [applyCustomOrigin]
  );

  const handleAirportSelect = useCallback(
    (iata: string) => {
      if (!iata) return;
      const selected = AIRPORTS.find((airport) => airport.iata === iata);
      if (!selected) return;
      const nextOrigin: TravelOrigin = {
        mode: "custom",
        label: `${selected.iata} (${selected.city})`,
        lat: selected.lat,
        lon: selected.lon,
        updatedAt: Date.now(),
      };
      applyCustomOrigin(nextOrigin);
      setAirportSelection(iata);
      setIsOriginSheetOpen(false);
    },
    [applyCustomOrigin]
  );

  const handleOpenFlights = useCallback(
    (destination: string) => {
      const departDateValue = departDate.trim() || undefined;
      const returnDateValue =
        roundTrip && returnDate.trim().length > 0 ? returnDate.trim() : undefined;
      const url = buildGoogleFlightsUrl({
        fromLabelOrIata: departure.iata,
        toLabelOrIata: destination,
        departDate: departDateValue,
        returnDate: returnDateValue,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [departDate, departure.iata, returnDate, roundTrip]
  );

  useEffect(() => {
    if (!roundTrip) {
      setReturnDate("");
    }
  }, [roundTrip]);

  useEffect(() => {
    if (origin.mode !== "device" || originHasCoords) return;
    attemptDeviceLocation(false);
  }, [attemptDeviceLocation, origin.mode, originHasCoords]);

  if (!country || !focus) {
    return (
      <div className="fixed inset-x-4 bottom-6 z-20 flex justify-center md:right-6 md:top-20 md:bottom-6 md:left-auto md:w-[380px]">
        <div className="flex h-full min-h-0 w-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-200 backdrop-blur-lg md:text-left">
          <div className="shrink-0">
            <p className="font-display text-2xl text-white">Select a country</p>
            <p className="mt-2 text-slate-300">
              Hover to preview. Click to focus and load weather plus highlights.
            </p>
          </div>
          <div className="mt-5 flex-1 min-h-0 flex flex-col text-left">
            <AtlasChat
              variant="panel"
              threadKey="global"
              context={{ mode: "explore" }}
              agentMode={agentMode}
              onAgentModeChange={onAgentModeChange}
              onExecuteActions={onExecuteActions}
              uiContext={uiContext}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.aside
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-x-4 bottom-6 z-20 md:right-6 md:top-20 md:bottom-6 md:left-auto md:w-[380px]"
      aria-live="polite"
    >
      <div className="flex h-full min-h-0 max-h-[72vh] flex-col gap-5 overflow-hidden rounded-[32px] border border-white/10 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl md:max-h-full">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-200">
              Country Focus
            </p>
            <h2 className="font-display text-3xl leading-tight text-white">
              {country.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-200">
              <Badge variant="secondary">Capital: {country.capital || "-"}</Badge>
              <Badge variant="secondary">
                Population: {formatPopulation(country.population)}
              </Badge>
            </div>
          </div>
          <ChatFab onClick={() => setChatOpen(true)} />
        </div>

        <Card className="border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-200">
              Weather
            </p>
            <span className="text-xs text-slate-400">
              {weatherState.data?.provider || "Forecast"}
            </span>
          </div>
          {weatherState.loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-1/2 bg-white/10" />
              <Skeleton className="h-4 w-2/3 bg-white/10" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={`weather-skel-${index}`}
                    className="h-16 w-16 bg-white/10"
                  />
                ))}
              </div>
              {weatherState.data?.errors?.forecast ? (
                <p className="text-xs text-amber-200">
                  Forecast unavailable. Showing current conditions.
                </p>
              ) : null}
            </div>
          ) : weatherState.error ? (
            <p className="mt-4 text-sm text-amber-200">
              {weatherState.error}
            </p>
          ) : weatherState.data ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <Image
                  src={weatherIconUrl(weatherState.data.current.icon)}
                  alt={weatherState.data.current.description}
                  width={48}
                  height={48}
                  className="h-12 w-12"
                  unoptimized
                />
                <div>
                  <p className="text-2xl font-semibold">
                    {Math.round(weatherState.data.current.tempC)}°C
                  </p>
                  <p className="text-sm text-slate-200">
                    {weatherState.data.current.description}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {weatherState.data.daily.slice(0, 4).map((day) => (
                  <div
                    key={day.date}
                    className="rounded-2xl border border-white/10 bg-white/5 p-2 text-center"
                  >
                    <p className="text-[10px] tracking-widest text-slate-300">
                      {new Date(day.date).toLocaleDateString("de-DE", {
                        weekday: "short",
                      })}
                    </p>
                    <Image
                      src={weatherIconUrl(day.icon)}
                      alt={day.description}
                      width={32}
                      height={32}
                      className="mx-auto h-8 w-8"
                      unoptimized
                    />
                    <p className="text-sm font-semibold">
                      {Math.round(day.maxC)}°C
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-300">
              Weather data will appear once an API key is configured.
            </p>
          )}
        </Card>

        <Card className="border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-200">
              Flüge
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsOriginSheetOpen(true)}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              ändern
            </Button>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
              Von
            </p>
            {originStatus === "loading" ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-4 w-32 bg-white/10" />
                <Skeleton className="h-3 w-24 bg-white/10" />
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-slate-100">{departure.label}</p>
                {origin.mode === "device" ? (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Quelle: {origin.label}
                  </p>
                ) : null}
              </>
            )}
            {originHint ? (
              <p className="mt-2 text-xs text-amber-200">{originHint}</p>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 text-xs text-slate-200">
            <label className="grid gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                Hinflug
              </span>
              <input
                type="date"
                value={departDate}
                onChange={(event) => setDepartDate(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span>Rückflug</span>
              <input
                type="checkbox"
                checked={roundTrip}
                onChange={(event) => setRoundTrip(event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                Rückflug Datum
              </span>
              <input
                type="date"
                value={returnDate}
                onChange={(event) => setReturnDate(event.target.value)}
                disabled={!roundTrip}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-200">
              Ziele
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {destinations.length ? (
                destinations.map((destination) => (
                  <Button
                    key={`flight-${destination}`}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenFlights(destination)}
                  >
                    {destination}
                  </Button>
                ))
              ) : (
                <span className="text-sm text-slate-400">Keine Ziele</span>
              )}
            </div>
          </div>
        </Card>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-200">
            Top Cities
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {country.topCities?.map((city) => (
              <Badge key={city.name} className="bg-white/10 text-white">
                {city.name}
              </Badge>
            )) || <span className="text-sm text-slate-400">No data</span>}
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-200">
              Places to Visit
            </p>
            {placesLabel ? (
              <span className="text-xs text-slate-400">{placesLabel}</span>
            ) : null}
          </div>
          {placesState.loading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={`poi-skel-${index}`}
                  className="h-14 w-full bg-white/10"
                />
              ))}
            </div>
          ) : placesState.error ? (
            <p className="mt-4 text-sm text-amber-200">
              {placesState.error}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {poiCards.map((poi) => (
                <div
                  key={poi.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{poi.name}</p>
                    <p className="text-xs text-slate-300">{poi.category}</p>
                  </div>
                  {poi.rating ? (
                    <Badge className="bg-white/15 text-white">
                      {poi.rating.toFixed(1)}
                    </Badge>
                  ) : null}
                </div>
              ))}
              {!poiCards.length ? (
                <p className="text-sm text-slate-400">No places yet.</p>
              ) : null}
            </div>
          )}
        </div>

        <Sheet open={isOriginSheetOpen} onOpenChange={setIsOriginSheetOpen}>
          <SheetContent
            side="right"
            className="w-[380px] max-w-[92vw] rounded-l-[32px] border-l border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl"
          >
            <SheetHeader className="border-b border-white/10 px-6 pb-4 pt-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Abflug
              </p>
              <SheetTitle className="font-display text-2xl text-white">
                Abflugort wählen
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Mein Standort verwenden
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Nutzt den aktuellen Standort für den Abflug.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleUseDeviceOrigin}
                  className="mt-3 w-full"
                >
                  Mein Standort verwenden
                </Button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Ort suchen
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={geocodeQuery}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setGeocodeQuery(nextValue);
                      if (nextValue.trim().length < 2) {
                        setGeocodeResults([]);
                        setGeocodeStatus("idle");
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleGeocodeSearch();
                      }
                    }}
                    placeholder="Stadt oder Adresse"
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGeocodeSearch}
                    disabled={geocodeStatus === "loading"}
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                  >
                    Suchen
                  </Button>
                </div>
                {geocodeStatus === "loading" ? (
                  <div className="mt-3 space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton
                        key={`geocode-skel-${index}`}
                        className="h-8 w-full bg-white/10"
                      />
                    ))}
                  </div>
                ) : null}
                {geocodeStatus === "error" ? (
                  <p className="mt-2 text-xs text-rose-300">
                    Suche fehlgeschlagen.
                  </p>
                ) : null}
                {geocodeResults.length ? (
                  <div className="mt-3 space-y-2">
                    {geocodeResults.map((result, index) => (
                      <button
                        key={`${result.name}-${result.lat}-${result.lon}-${index}`}
                        type="button"
                        onClick={() => handleSelectGeocodeResult(result)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/30"
                      >
                        <p className="text-sm text-white">{result.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          {result.country ?? result.type ?? "Ort"}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : showGeocodeEmpty ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Keine Treffer.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Flughafen wählen
                </p>
                <select
                  value={airportSelection}
                  onChange={(event) => handleAirportSelect(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                >
                  <option value="">Bitte wählen</option>
                  {AIRPORTS.map((airport) => (
                    <option key={airport.iata} value={airport.iata}>
                      {airport.iata} - {airport.city}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Link
          href={
            focus.kind === "city"
              ? `/map?lat=${focus.lat}&lon=${focus.lon}&country=${focus.code ?? ""}&city=${encodeURIComponent(focus.name)}`
              : `/map?lat=${focus.lat}&lon=${focus.lon}&country=${focus.code ?? ""}`
          }
        >
          <Button className="w-full md:hidden">Open Map</Button>
        </Link>
      </div>
      <ChatSheet
        open={chatOpen}
        onOpenChange={setChatOpen}
        threadKey={threadKey}
        context={aiContext}
        agentMode={agentMode}
        onAgentModeChange={onAgentModeChange}
        onExecuteActions={onExecuteActions}
        uiContext={uiContext}
      />
    </motion.aside>
  );
};

export default CountryPanel;
