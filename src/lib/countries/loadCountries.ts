/*
  Dieses File lädt GeoJSON-Länderdaten vom Server:

  resolveBaseUrl() findet die richtige URL der App (aus Umgebungsvariablen, Request-Headern oder localhost als Fallback).
  loadCountries() holt die Datei /data/countries.geojson per fetch und gibt die Daten zurück.
  Die Daten werden 24 Stunden gecacht.
  import "server-only" stellt sicher, dass der Code nur serverseitig läuft.
*/

import "server-only";

import { headers } from "next/headers";
import type { CountriesGeoJson } from "@/lib/countries/geo";

const resolveBaseUrl = async () => {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (envUrl) return envUrl;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
};

export const loadCountries = async (): Promise<CountriesGeoJson> => {
  const baseUrl = await resolveBaseUrl();
  const url = new URL("/data/countries.geojson", baseUrl);
  const response = await fetch(url.toString(), {
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error("Failed to load countries geojson");
  }

  return (await response.json()) as CountriesGeoJson;
};
