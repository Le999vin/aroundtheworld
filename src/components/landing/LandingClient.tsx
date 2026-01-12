//Startseiten-UI (Header, Suche, Globus, CountryPanel)
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
});

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

  const resolveCountryFocus = (
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
  };

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

  const mapHref = useMemo(() => {
    if (!focus) return "/map";
    const params = new URLSearchParams({
      lat: focus.lat.toString(),
      lon: focus.lon.toString(),
    });
    if (focus.code) params.set("country", focus.code);
    if (focus.kind === "city" && focus.name) {
      params.set("city", focus.name);
    }
    return `/map?${params.toString()}`;
  }, [focus]);

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
          countries={countries}
          selectedCountry={focus ? { lat: focus.lat, lon: focus.lon } : null}
          selectedCountryCode={focus?.code ?? null}
          onSelectCountry={(code) => {
            if (!code) return;
            const next = resolveCountryFocus(code, "globe");
            if (next) setFocus(next);
          }}
        />
        <CountryPanel country={selectedCountry} focus={focus} />

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
