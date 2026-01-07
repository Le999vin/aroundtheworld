"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CountryPanel from "@/components/panels/CountryPanel";
import GlobalSearch, {
  type SearchResult,
} from "@/components/search/GlobalSearch";
import { Button } from "@/components/ui/button";
import { countryMeta, countryMetaByCode } from "@/lib/countries/countryMeta";
import {
  getFeatureCenter,
  getCountryName,
  type CountriesGeoJson,
  type CountryFeature,
} from "@/lib/countries/geo";
import type { Country } from "@/lib/types";

type LandingClientProps = {
  countries: CountriesGeoJson;
};

const GlobeGL = dynamic(() => import("@/components/globe/GlobeGL"), {
  ssr: false,
});

const getGlobeCountryCode = (feature: CountryFeature) => {
  const props = feature.properties ?? {};
  return (
    (props.ISO_A2 as string | undefined) ||
    (props.iso_a2 as string | undefined) ||
    (props.id as string | undefined) ||
    (feature.id as string | undefined) ||
    ""
  );
};

export const LandingClient = ({ countries }: LandingClientProps) => {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  const countryLookup = useMemo(() => {
    const features = (countries?.features ?? []) as CountryFeature[];
    return features.reduce<Record<string, Country>>((acc, feature) => {
      const code = getGlobeCountryCode(feature);
      if (!code) return acc;
      const center = getFeatureCenter(feature);
      const meta = countryMetaByCode[code];
      acc[code] = {
        code,
        name: getCountryName(feature),
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

  const handleSearch = (result: SearchResult) => {
    setSelectedCountry({
      ...result.country,
      lat: result.lat,
      lon: result.lon,
    });
  };

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
            href={
              selectedCountry
                ? `/map?lat=${selectedCountry.lat}&lon=${selectedCountry.lon}`
                : "/map"
            }
          >
            <Button className="w-full md:w-auto">Open Map</Button>
          </Link>
        </div>
      </header>

      <main className="relative h-screen">
        <GlobeGL
          countries={countries}
          selectedCountryCode={selectedCountry?.code ?? null}
          onSelectCountry={(code) => {
            if (!code) return;
            const next = countryLookup[code] ?? countryMetaByCode[code] ?? null;
            if (next) setSelectedCountry(next);
          }}
        />
        <CountryPanel country={selectedCountry} />

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
