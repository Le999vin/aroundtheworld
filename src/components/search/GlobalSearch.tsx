"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Country } from "@/lib/types";

export type SearchResult = {
  id: string;
  label: string;
  type: "country" | "city" | "poi";
  country: Country;
  lat: number;
  lon: number;
};

type GlobalSearchProps = {
  countries: Country[];
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
};

const buildSearchIndex = (countries: Country[]): SearchResult[] => {
  const results: SearchResult[] = [];

  countries.forEach((country) => {
    results.push({
      id: `country-${country.code}`,
      label: country.name,
      type: "country",
      country,
      lat: country.lat,
      lon: country.lon,
    });

    country.topCities?.forEach((city) => {
      results.push({
        id: `city-${country.code}-${city.name}`,
        label: `${city.name}, ${country.name}`,
        type: "city",
        country,
        lat: city.lat,
        lon: city.lon,
      });
    });

    country.topPlaces?.forEach((place) => {
      results.push({
        id: `poi-${country.code}-${place.name}`,
        label: `${place.name} (${country.name})`,
        type: "poi",
        country,
        lat: country.lat,
        lon: country.lon,
      });
    });
  });

  return results;
};

export const GlobalSearch = ({
  countries,
  onSelect,
  placeholder = "Search country, city, or place",
}: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const index = useMemo(() => buildSearchIndex(countries), [countries]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) return [];
    return index
      .filter((item) => item.label.toLowerCase().includes(trimmed))
      .slice(0, 8);
  }, [index, query]);

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    setQuery("");
    setActiveIndex(0);
  };

  return (
    <div className="relative w-full max-w-xs">
      <label className="sr-only" htmlFor="global-search">
        Global search
      </label>
      <input
        id="global-search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (!results.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const item = results[activeIndex];
            if (item) handleSelect(item);
          }
          if (event.key === "Escape") {
            setQuery("");
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-slate-300 outline-none ring-offset-transparent transition focus-visible:ring-2 focus-visible:ring-cyan-300"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="global-search-results"
        aria-activedescendant={
          results.length ? `result-${results[activeIndex].id}` : undefined
        }
      />

      {results.length ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 text-sm text-white shadow-xl backdrop-blur"
        >
          {results.map((result, index) => (
            <button
              key={result.id}
              id={`result-${result.id}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(result);
              }}
              className={cn(
                "flex w-full items-center justify-between px-4 py-2 text-left transition",
                index === activeIndex
                  ? "bg-white/10"
                  : "hover:bg-white/5"
              )}
            >
              <span>{result.label}</span>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {result.type}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default GlobalSearch;
