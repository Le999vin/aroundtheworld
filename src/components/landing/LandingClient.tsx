//Startseiten-UI (Header, Suche, Globus, CountryPanel)
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import CountryPanel from "@/components/panels/CountryPanel";
import GlobalSearch, {
  type SearchResult,
} from "@/components/search/GlobalSearch";
import { Button } from "@/components/ui/button";
import {
  countryMeta,
  countryMetaByCode,
  getCapitalCoordinates,
  getCountryMeta,
  getCountryMetaByName,
  resolveCountryCode,
  resolveCountryCenterFromMeta,
} from "@/lib/countries/countryMeta";
import type {
  AiActionEnvelope,
  AiActionExecutionResult,
  AiAgentMode,
  AiUiContext,
} from "@/lib/ai/actions";
import { resolveCountryCodeFromText } from "@/lib/ai/resolveCountry";
import type { GlobeHandle } from "@/components/globe/GlobeGL";
import {
  getCountryCode,
  getFeatureBboxCenter,
  getFeatureCenter,
  getCountryName,
  type CountriesGeoJson,
  type CountryFeature,
} from "@/lib/countries/geo";
import type { Country, Focus } from "@/lib/types";

type LandingClientProps = {
  countries: CountriesGeoJson;
};

const GlobeGL = dynamic(() => import("@/components/globe/GlobeGL"), {
  ssr: false,
}) as typeof import("@/components/globe/GlobeGL").default;

const normalizeCountryCodeCandidate = (
  value: string | number | null | undefined
) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "-99") return null;
  return trimmed.toUpperCase();
};

const isValidLatLon = (lat?: number, lon?: number) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat as number) > 90 || Math.abs(lon as number) > 180) {
    return false;
  }
  return true;
};

const isZeroCenter = (lat: number, lon: number) =>
  Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001;

const AGENT_MODE_STORAGE_KEY = "gta.agentMode.v1";
const AI_ORB_DURATION_MS = 900;

const pickCenter = (
  ...candidates: Array<{ lat: number; lon: number } | null | undefined>
) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!isValidLatLon(candidate.lat, candidate.lon)) continue;
    if (isZeroCenter(candidate.lat, candidate.lon)) continue;
    return candidate;
  }
  return null;
};

const buildFocus = ({
  kind,
  source,
  code,
  name,
  center,
}: {
  kind: Focus["kind"];
  source: Focus["source"];
  code?: string;
  name: string;
  center: { lat: number; lon: number } | null;
}): Focus | null => {
  if (!center) return null;
  if (!isValidLatLon(center.lat, center.lon)) return null;
  if (isZeroCenter(center.lat, center.lon)) return null;
  return {
    kind,
    source,
    code,
    name,
    lat: center.lat,
    lon: center.lon,
  };
};

const getGlobeCountryCode = (feature: CountryFeature) => {
  const rawCode = getCountryCode(feature);
  const normalized = normalizeCountryCodeCandidate(rawCode);
  const resolved =
    (normalized ? resolveCountryCode(normalized) : null) ??
    resolveCountryCode(getCountryName(feature));
  return resolved ?? normalized ?? "";
};

export const LandingClient = ({ countries }: LandingClientProps) => {
  const router = useRouter();
  const globeRef = useRef<GlobeHandle | null>(null);
  const [agentMode, setAgentMode] = useState<AiAgentMode>(() => {
    if (typeof window === "undefined") return "off";
    const stored = window.localStorage.getItem(AGENT_MODE_STORAGE_KEY);
    return stored === "off" || stored === "confirm" || stored === "auto"
      ? stored
      : "off";
  });
  const [orbFlight, setOrbFlight] = useState<{
    id: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!focus) return;
    console.debug("[focus]", {
      kind: focus.kind,
      code: focus.code,
      lat: focus.lat,
      lon: focus.lon,
      source: focus.source,
    });
  }, [focus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AGENT_MODE_STORAGE_KEY, agentMode);
  }, [agentMode]);

  const countryLookup = useMemo(() => {
    const features = (countries?.features ?? []) as CountryFeature[];
    return features.reduce<Record<string, Country>>((acc, feature) => {
      const code = getGlobeCountryCode(feature);
      if (!code) return acc;
      const name = getCountryName(feature);
      const meta = countryMetaByCode[code] ?? getCountryMetaByName(name);
      const center = pickCenter(
        getFeatureCenter(feature),
        getCapitalCoordinates(meta ?? null),
        getFeatureBboxCenter(feature),
        resolveCountryCenterFromMeta(meta ?? null)
      );
      if (!center) return acc;
      acc[code] = {
        code,
        name: meta?.name ?? name,
        lat: center.lat,
        lon: center.lon,
        capital: meta?.capital,
        population: meta?.population,
        topCities: meta?.topCities,
        topPlaces: meta?.topPlaces,
      };
      return acc;
    }, {});
  }, [countries]);

  const triggerAiOrb = useCallback(() => {
    if (typeof window === "undefined") return;
    const from = {
      x: Math.max(window.innerWidth - 140, 24),
      y: Math.max(window.innerHeight - 200, 24),
    };
    const to = {
      x: Math.max(window.innerWidth / 2 - 12, 24),
      y: Math.max(window.innerHeight / 2 - 12, 24),
    };
    setOrbFlight({ id: Date.now(), from, to });
  }, []);

  const resolveCountryFocus = useCallback(
    (
    code: string,
    source: Focus["source"],
    nameHint?: string
    ) => {
      const base = countryLookup[code] ?? countryMetaByCode[code] ?? null;
      if (base) {
        return buildFocus({
          kind: "country",
          source,
        code: base.code,
        name: base.name,
        center: { lat: base.lat, lon: base.lon },
      });
    }
    const meta =
      getCountryMeta(code) ??
      (nameHint ? getCountryMetaByName(nameHint) : null);
    const center = resolveCountryCenterFromMeta(meta ?? null);
    return buildFocus({
      kind: "country",
      source,
      code: meta?.code ?? code,
      name: meta?.name ?? nameHint ?? code,
      center,
    });
    },
    [countryLookup]
  );

  const selectCountryByCode = useCallback(
    (code: string, source: Focus["source"] = "ai") => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) return null;
      const next = resolveCountryFocus(normalized, source);
      if (!next) return null;
      setFocus(next);
      globeRef.current?.flyToLatLon(next.lat, next.lon, { durationMs: 1400 });
      globeRef.current?.highlightCountry(next.code ?? normalized, { pulseMs: 1200 });
      triggerAiOrb();
      return next;
    },
    [resolveCountryFocus, triggerAiOrb]
  );

  const selectedCountry = useMemo<Country | null>(() => {
    if (!focus) return null;
    const base =
      (focus.code
        ? countryLookup[focus.code] ?? countryMetaByCode[focus.code]
        : null) ?? null;
    const code = base?.code ?? focus.code ?? "";
    return {
      code,
      name: base?.name ?? focus.name,
      lat: focus.lat,
      lon: focus.lon,
      capital: base?.capital,
      population: base?.population,
      topCities: base?.topCities,
      topPlaces: base?.topPlaces,
    };
  }, [countryLookup, focus]);

  const uiContext = useMemo<AiUiContext>(
    () => ({
      currentCountryCode: selectedCountry?.code,
      hasCountrySelected: Boolean(selectedCountry?.code),
    }),
    [selectedCountry?.code]
  );

  const handleSearch = (result: SearchResult) => {
    if (result.type === "city") {
      const cityName = result.label.split(",")[0]?.trim() || result.label;
      const next = buildFocus({
        kind: "city",
        source: "search",
        code: result.country.code,
        name: cityName,
        center: { lat: result.lat, lon: result.lon },
      });
      if (next) setFocus(next);
      return;
    }

    const next = resolveCountryFocus(
      result.country.code,
      "search",
      result.country.name
    );
    if (next) setFocus(next);
  };

  const buildMapHrefFromFocus = useCallback((target: Focus | null) => {
    if (!target) return "/map";
    const params = new URLSearchParams({
      lat: target.lat.toString(),
      lon: target.lon.toString(),
    });
    if (target.code) params.set("country", target.code);
    if (target.kind === "city" && target.name) {
      params.set("city", target.name);
    }
    return `/map?${params.toString()}`;
  }, []);

  const mapHref = useMemo(() => buildMapHrefFromFocus(focus), [buildMapHrefFromFocus, focus]);

  const executeAiActions = useCallback(
    async (envelope: AiActionEnvelope): Promise<AiActionExecutionResult> => {
      if (!envelope.actions.length) {
        return { ok: false, message: "Keine Aktionen vorhanden." };
      }
      const warnings: string[] = [];
      let executed = 0;
      let nextFocus: Focus | null = focus;

      for (const action of envelope.actions) {
        switch (action.type) {
          case "selectCountry": {
            const direct = action.code.trim().toUpperCase();
            const resolved =
              (countryLookup[direct] ? direct : null) ??
              resolveCountryCodeFromText(action.code, countryMeta);
            if (!resolved) {
              warnings.push(`Land nicht gefunden: ${action.code}`);
              break;
            }
            const next = selectCountryByCode(resolved, "ai");
            if (next) {
              nextFocus = next;
              executed += 1;
            } else {
              warnings.push(`Land nicht verfuegbar: ${resolved}`);
            }
            break;
          }
          case "openCountryPanel": {
            if (!nextFocus) {
              warnings.push("Kein Land ausgewaehlt.");
            } else {
              executed += 1;
            }
            break;
          }
          case "openMapMode": {
            router.push(buildMapHrefFromFocus(nextFocus));
            executed += 1;
            break;
          }
          case "focusCity": {
            if (action.lat === undefined || action.lon === undefined) {
              warnings.push("City-Aktion braucht Koordinaten.");
              break;
            }
            const next = buildFocus({
              kind: "city",
              source: "ai",
              code: selectedCountry?.code,
              name: action.name?.trim() || "City",
              center: { lat: action.lat, lon: action.lon },
            });
            if (!next) {
              warnings.push("City-Koordinaten ungueltig.");
              break;
            }
            setFocus(next);
            nextFocus = next;
            globeRef.current?.flyToLatLon(next.lat, next.lon, { durationMs: 1200 });
            triggerAiOrb();
            executed += 1;
            break;
          }
          case "addPoiToPlan":
          case "buildItinerary":
          case "setOrigin":
            warnings.push("Aktion in dieser Ansicht nicht verfuegbar.");
            break;
          default:
            warnings.push("Unbekannte Aktion ignoriert.");
        }
      }

      return {
        ok: executed > 0,
        message: warnings.length ? warnings.join(" ") : undefined,
      };
    },
    [
      buildMapHrefFromFocus,
      countryLookup,
      focus,
      router,
      selectCountryByCode,
      selectedCountry?.code,
      triggerAiOrb,
    ]
  );

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <header className="absolute left-0 right-0 top-0 z-30 flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold">
            GT
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
              Global Travel
            </p>
            <p className="font-display text-lg">Atlas</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <GlobalSearch countries={countryMeta} onSelect={handleSearch} />
          <Link
            href={mapHref}
            className="hidden md:inline-flex"
          >
            <Button>Open Map</Button>
          </Link>
        </div>
      </header>

      <main className="relative h-screen">
        <GlobeGL
          ref={globeRef}
          countries={countries}
          selectedCountry={focus ? { lat: focus.lat, lon: focus.lon } : null}
          selectedCountryCode={focus?.code ?? null}
          onSelectCountry={(code) => {
            if (!code) return;
            const next = resolveCountryFocus(code, "globe");
            if (next) setFocus(next);
          }}
        />
        {orbFlight ? (
          <motion.div
            key={orbFlight.id}
            className="pointer-events-none fixed inset-0 z-40"
          >
            <motion.div
              className="absolute h-6 w-6 rounded-full bg-cyan-300/80 shadow-[0_0_24px_rgba(56,189,248,0.7)]"
              initial={{
                x: orbFlight.from.x,
                y: orbFlight.from.y,
                opacity: 0,
                scale: 0.6,
              }}
              animate={{
                x: orbFlight.to.x,
                y: orbFlight.to.y,
                opacity: 1,
                scale: 1,
              }}
              transition={{
                duration: AI_ORB_DURATION_MS / 1000,
                ease: [0.22, 0.61, 0.36, 1],
              }}
              onAnimationComplete={() => setOrbFlight(null)}
            />
          </motion.div>
        ) : null}
        <CountryPanel
          country={selectedCountry}
          focus={focus}
          agentMode={agentMode}
          onAgentModeChange={setAgentMode}
          onExecuteActions={executeAiActions}
          uiContext={uiContext}
        />

        <div className="pointer-events-none absolute bottom-20 left-6 z-10 max-w-md md:left-12">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
            Explore the World
          </p>
          <h1 className="font-display text-4xl leading-tight text-white md:text-5xl">
            Dive into destinations, weather, and curated experiences.
          </h1>
          <p className="mt-4 text-sm text-slate-300 md:text-base">
            Spin the globe, focus on a country, and unlock live forecasts plus
            handpicked highlights.
          </p>
        </div>
      </main>
    </div>
  );
};

export default LandingClient;
