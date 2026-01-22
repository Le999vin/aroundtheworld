"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buildGoogleDirectionsUrl } from "@/lib/maps/googleDirections";
import { encodeItinerary } from "@/lib/itinerary/share";
import type { Itinerary } from "@/lib/itinerary/types";
import { useItinerary } from "@/lib/itinerary/store";
import { estimateEtaMinutes, sumRouteKmWithOrigin } from "@/lib/map/distance";
import type { GeocodeResult } from "@/lib/types";

type ItineraryWidgetProps = {
  getMapCenter?: () => { lat: number; lon: number } | undefined;
};

const copyToClipboard = async (text: string) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
};

const formatDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
};

export const ItineraryWidget = ({ getMapCenter }: ItineraryWidgetProps) => {
  const {
    selectedStops,
    optimizedStops,
    mode,
    origin,
    originCoordinates,
    scenarios,
    planMeta,
    settings,
    maxStops,
    notice,
    setMode,
    reset,
    createPlan,
    setOriginDevice,
    setOriginCustom,
    saveScenarioFromCurrentOrigin,
    removeScenario,
    setPlannedFor,
    setNote,
    setRoundTrip,
    setShareIncludeExactOrigin,
  } = useItinerary();
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");
  const [originSheetOpen, setOriginSheetOpen] = useState(false);
  const [originQuery, setOriginQuery] = useState("");
  const [originResults, setOriginResults] = useState<GeocodeResult[]>([]);
  const [originSearchState, setOriginSearchState] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [scenarioLabel, setScenarioLabel] = useState("");

  const canCreatePlan = selectedStops.length >= 2;
  const hasPlan = Boolean(optimizedStops?.length);
  const originHasCoords = useMemo(
    () => Number.isFinite(origin.lat) && Number.isFinite(origin.lon),
    [origin]
  );
  const showNoOriginResults =
    originQuery.trim().length >= 2 &&
    originSearchState === "idle" &&
    originResults.length === 0;
  const distanceKm = useMemo(
    () =>
      optimizedStops
        ? sumRouteKmWithOrigin(
            originCoordinates,
            optimizedStops,
            settings.roundTrip
          )
        : 0,
    [optimizedStops, originCoordinates, settings.roundTrip]
  );
  const etaMin = useMemo(
    () => (distanceKm ? estimateEtaMinutes(distanceKm, mode) : 0),
    [distanceKm, mode]
  );

  const directionsUrl = useMemo(
    () =>
      optimizedStops
        ? buildGoogleDirectionsUrl(
            originCoordinates,
            optimizedStops,
            mode,
            settings.roundTrip
          )
        : null,
    [mode, optimizedStops, originCoordinates, settings.roundTrip]
  );

  const handleCreatePlan = useCallback(() => {
    createPlan();
  }, [createPlan]);

  const handleOpenDirections = useCallback(() => {
    if (!directionsUrl) return;
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  }, [directionsUrl]);

  const handleCopyLink = useCallback(async () => {
    const itinerary: Itinerary = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `itinerary-${Date.now()}`,
      createdAt: Date.now(),
      mode,
      stops: selectedStops,
      optimizedStops: optimizedStops ?? undefined,
      origin,
      settings,
      planMeta,
    };
    const encoded = encodeItinerary(itinerary);
    if (!encoded) {
      setCopyState("error");
      return;
    }

    const url = `${window.location.origin}/map?itinerary=${encoded}`;
    const ok = await copyToClipboard(url);
    setCopyState(ok ? "success" : "error");
    window.setTimeout(() => setCopyState("idle"), 2000);
  }, [mode, optimizedStops, origin, planMeta, selectedStops, settings]);

  const handleUseDeviceOrigin = useCallback(() => {
    setOriginDevice();
    setOriginSheetOpen(false);
  }, [setOriginDevice]);

  const handleUseMapCenter = useCallback(() => {
    const center = getMapCenter?.();
    if (!center) return;
    setOriginCustom(center.lat, center.lon, "Pin");
    setOriginSheetOpen(false);
  }, [getMapCenter, setOriginCustom]);

  const handleOriginSearch = useCallback(async () => {
    const query = originQuery.trim();
    if (query.length < 2) {
      setOriginResults([]);
      setOriginSearchState("idle");
      return;
    }
    setOriginSearchState("loading");
    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error("Geocode failed");
      const data = (await response.json()) as GeocodeResult[];
      setOriginResults(Array.isArray(data) ? data : []);
      setOriginSearchState("idle");
    } catch {
      setOriginResults([]);
      setOriginSearchState("error");
    }
  }, [originQuery]);

  const handleSelectOriginResult = useCallback(
    (result: GeocodeResult) => {
      const label = result.country
        ? `${result.name}, ${result.country}`
        : result.name;
      setOriginCustom(result.lat, result.lon, label);
      setOriginSheetOpen(false);
    },
    [setOriginCustom]
  );

  const handleSaveScenario = useCallback(() => {
    saveScenarioFromCurrentOrigin(scenarioLabel);
    setScenarioLabel("");
  }, [saveScenarioFromCurrentOrigin, scenarioLabel]);

  const handleSelectScenario = useCallback(
    (scenario: { lat: number; lon: number; label: string }) => {
      setOriginCustom(scenario.lat, scenario.lon, scenario.label);
      setOriginSheetOpen(false);
    },
    [setOriginCustom]
  );

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 md:left-auto md:right-6 md:w-[340px]">
      <div className="pointer-events-auto rounded-3xl border border-white/10 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Dein Plan
            </p>
            <p className="mt-1 text-sm text-slate-200">
              {selectedStops.length} Orte ausgewaehlt
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
            {selectedStops.length}/{maxStops}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
              Startpunkt
            </p>
            <p className="mt-1 text-sm text-slate-200">{origin.label}</p>
            {origin.mode === "device" && !originHasCoords ? (
              <p className="mt-1 text-[10px] text-slate-400">
                Standort wird ermittelt.
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOriginSheetOpen(true)}
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            ändern
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-xs text-slate-200">
          <button
            type="button"
            onClick={() => setMode("walk")}
            className={`flex-1 rounded-full px-3 py-1 transition ${
              mode === "walk" ? "bg-cyan-300/20 text-cyan-100" : "text-slate-300"
            }`}
          >
            Zu Fuss
          </button>
          <button
            type="button"
            onClick={() => setMode("drive")}
            className={`flex-1 rounded-full px-3 py-1 transition ${
              mode === "drive" ? "bg-cyan-300/20 text-cyan-100" : "text-slate-300"
            }`}
          >
            Auto
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-xs text-slate-200">
          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <span>Rundreise (zurück zum Start)</span>
            <input
              type="checkbox"
              checked={settings.roundTrip}
              onChange={(event) => setRoundTrip(event.target.checked)}
              className="h-4 w-4 accent-cyan-300"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
              Geplant fuer
            </span>
            <input
              type="date"
              value={planMeta.plannedFor ?? ""}
              onChange={(event) => setPlannedFor(event.target.value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
              Notiz
            </span>
            <textarea
              rows={2}
              value={planMeta.note ?? ""}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
              className="resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!canCreatePlan}
            onClick={handleCreatePlan}
            className="flex-1"
          >
            Plan erstellen
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={reset}
            className="flex-1 text-slate-200 hover:bg-white/10"
          >
            Zuruecksetzen
          </Button>
        </div>

        {notice ? (
          <p className="mt-2 text-xs text-amber-300">{notice}</p>
        ) : null}

        {hasPlan ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Optimierte Route
            </p>
            {distanceKm > 0 ? (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                <span>Distanz: {distanceKm.toFixed(1)} km</span>
                <span>Zeit: {formatDuration(etaMin)}</span>
              </div>
            ) : null}
            <ol className="mt-3 space-y-2 text-sm text-slate-200">
              {optimizedStops?.map((stop, index) => (
                <li key={stop.id} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-slate-200">
                    {index + 1}
                  </span>
                  <span>{stop.name}</span>
                </li>
              ))}
            </ol>

            <label className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
              <span>Exakten Startpunkt teilen</span>
              <input
                type="checkbox"
                checked={settings.shareIncludeExactOrigin}
                onChange={(event) =>
                  setShareIncludeExactOrigin(event.target.checked)
                }
                className="h-4 w-4 accent-cyan-300"
              />
            </label>

            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenDirections}
                disabled={!directionsUrl}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                Google Maps Route oeffnen
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyLink}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                Link kopieren
              </Button>
            </div>

            {copyState === "success" ? (
              <p className="mt-2 text-xs text-emerald-300">Link kopiert.</p>
            ) : copyState === "error" ? (
              <p className="mt-2 text-xs text-rose-300">
                Link konnte nicht kopiert werden.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <Sheet open={originSheetOpen} onOpenChange={setOriginSheetOpen}>
        <SheetContent
          side="right"
          className="w-[380px] max-w-[92vw] rounded-l-[32px] border-l border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl"
        >
          <SheetHeader className="border-b border-white/10 px-6 pb-4 pt-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Startpunkt
            </p>
            <SheetTitle className="font-display text-2xl text-white">
              Origin setzen
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Mein Standort
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Verwende den aktuellen Standort (GPS).
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
                  value={originQuery}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setOriginQuery(nextValue);
                    if (nextValue.trim().length < 2) {
                      setOriginResults([]);
                      setOriginSearchState("idle");
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleOriginSearch();
                    }
                  }}
                  placeholder="Stadt oder Adresse"
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleOriginSearch}
                  disabled={originSearchState === "loading"}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  Suchen
                </Button>
              </div>
              {originSearchState === "loading" ? (
                <p className="mt-2 text-xs text-slate-400">Suche laeuft...</p>
              ) : null}
              {originSearchState === "error" ? (
                <p className="mt-2 text-xs text-rose-300">
                  Suche fehlgeschlagen.
                </p>
              ) : null}
              {originResults.length ? (
                <div className="mt-3 space-y-2">
                  {originResults.map((result, index) => (
                    <button
                      key={`${result.name}-${result.lat}-${result.lon}-${index}`}
                      type="button"
                      onClick={() => handleSelectOriginResult(result)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/30"
                    >
                      <p className="text-sm text-white">{result.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                        {result.country ?? result.type ?? "Ort"}
                      </p>
                    </button>
                  ))}
                </div>
              ) : showNoOriginResults ? (
                <p className="mt-2 text-xs text-slate-400">Keine Treffer.</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Pin setzen
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Bewege die Karte, dann übernehmen.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleUseMapCenter}
                disabled={!getMapCenter}
                className="mt-3 w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                Kartenmittelpunkt übernehmen
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Gespeicherte Orte
              </p>
              {scenarios.length ? (
                <div className="mt-3 space-y-2">
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectScenario(scenario)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-white/30"
                      >
                        {scenario.label}
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeScenario(scenario.id)}
                        className="text-slate-300 hover:bg-white/10"
                      >
                        Entfernen
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  Noch keine gespeicherten Orte.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={scenarioLabel}
                  onChange={(event) => setScenarioLabel(event.target.value)}
                  placeholder="Label"
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveScenario}
                  disabled={!originHasCoords}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  Speichern
                </Button>
              </div>
              {!originHasCoords ? (
                <p className="mt-2 text-xs text-slate-400">
                  Kein Startpunkt mit Koordinaten verfuegbar.
                </p>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ItineraryWidget;
