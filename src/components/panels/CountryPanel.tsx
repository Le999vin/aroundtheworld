// rechte/untere Info-Karte mit Wetter + Places
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Country, Focus, POI, WeatherData } from "@/lib/types";

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

export const CountryPanel = ({ country, focus }: CountryPanelProps) => {
  const reduceMotion = useReducedMotion();
  const weatherState = useCountryWeather(focus);
  const placesState = useCountryPlaces(country, focus);

  const poiCards = useMemo<POI[]>(
    () => placesState.data?.slice(0, 5) ?? [],
    [placesState.data]
  );

  const placesLabel = useMemo(() => {
    if (!placesState.data?.length) return null;
    return placesState.data.some((poi) => poi.cityId) ? "Local" : "Curated";
  }, [placesState.data]);

  if (!country || !focus) {
    return (
      <div className="pointer-events-none fixed inset-x-4 bottom-6 z-20 flex justify-center md:right-6 md:top-20 md:bottom-6 md:left-auto md:w-[380px]">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-200 backdrop-blur-lg md:text-left">
          <p className="font-display text-2xl text-white">Select a country</p>
          <p className="mt-2 text-slate-300">
            Hover to preview. Click to focus and load weather plus highlights.
          </p>
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
      <div className="flex h-full max-h-[72vh] flex-col gap-5 overflow-hidden rounded-[32px] border border-white/10 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl md:max-h-full">
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

        <div className="flex-1">
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
    </motion.aside>
  );
};

export default CountryPanel;
