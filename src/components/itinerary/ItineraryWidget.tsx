"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildGoogleDirectionsUrl } from "@/lib/maps/googleDirections";
import { encodeItinerary } from "@/lib/itinerary/share";
import type { Itinerary } from "@/lib/itinerary/types";
import { useItinerary } from "@/lib/itinerary/store";

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

export const ItineraryWidget = ({ getMapCenter }: ItineraryWidgetProps) => {
  const {
    selectedStops,
    optimizedStops,
    mode,
    maxStops,
    notice,
    setMode,
    reset,
    createPlan,
  } = useItinerary();
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");

  const canCreatePlan = selectedStops.length >= 2;
  const hasPlan = Boolean(optimizedStops?.length);

  const directionsUrl = useMemo(
    () =>
      optimizedStops
        ? buildGoogleDirectionsUrl(optimizedStops, mode)
        : null,
    [mode, optimizedStops]
  );

  const handleCreatePlan = useCallback(() => {
    const center = getMapCenter?.();
    createPlan(center);
  }, [createPlan, getMapCenter]);

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
  }, [mode, optimizedStops, selectedStops]);

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
    </div>
  );
};

export default ItineraryWidget;
