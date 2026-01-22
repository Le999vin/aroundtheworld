# Global Travel Atlas

Global Travel Atlas ist eine interaktive Reise-App mit 3D-Globus, Live-Wetter und kuratierten Points of Interest (POIs). Die App verbindet eine visuelle Laenderkundung mit einer Map-Ansicht, die POIs nach Kategorien filtert.

## Features
- 3D-Globus mit Hover und Click auf Laender
- Country Panel mit Wetter, Metadaten und POIs
- MapLibre Karte mit Markern und Kategorie-Filtern
- JSON-only POI Daten (keine externe Places API)
- API Routes mit strukturierten Fehlerantworten

## Tech Stack
- Next.js 16 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- globe.gl / three.js fuer den 3D-Globus
- MapLibre GL fuer die Karte
- OpenWeather als Wetter-Provider
- JSON Datasets fuer POIs und Country Meta

## Quick Start (Local Dev)

### Voraussetzungen
- Node.js 18+ (empfohlen)
- npm (package-lock.json ist vorhanden)

### Installieren und starten
```bash
npm install
npm run dev
```

### Default URLs
- http://localhost:3000
- http://localhost:3000/map

### Wichtige Scripts
```bash
npm run lint
npm run test
npm run build
npm run start
```

## Environment Variables (.env.local)

Die Datei `.env.local` ist in `.gitignore` und darf nie committed werden.

### Beispiel (.env.local.example)
```env
# Providers
WEATHER_PROVIDER=openweather
GEOCODING_PROVIDER=photon
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b

# Keys
OPENWEATHER_API_KEY=YOUR_OPENWEATHER_API_KEY

# Defaults
NEXT_PUBLIC_DEFAULT_UNITS=metric
NEXT_PUBLIC_DEFAULT_LANG=de
NEXT_PUBLIC_DEFAULT_LAT=47.3769
NEXT_PUBLIC_DEFAULT_LON=8.5417

# Optional: eigenes MapLibre Style
NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json

# Optional: Corporate Proxy / Custom CA (Server-side only)
NODE_EXTRA_CA_CERTS=C:\\path\\to\\corp-root.pem

# Optional: Dev-only TLS fallback (NICHT in Produktion)
ALLOW_INSECURE_TLS_FOR_DEV=1
```

### Warum diese Variablen
- `OPENWEATHER_API_KEY`: notwendig fuer `/api/weather`.
- `WEATHER_PROVIDER`, `GEOCODING_PROVIDER`: Auswahl der Provider.
- `NEXT_PUBLIC_DEFAULT_LAT/LON`: Default Zentrum fuer `/map`.
- `NEXT_PUBLIC_DEFAULT_UNITS`, `NEXT_PUBLIC_DEFAULT_LANG`: Wetter Einheiten und Sprache.
- `NEXT_PUBLIC_MAP_STYLE_URL`: optionaler MapLibre Style.
- `NODE_EXTRA_CA_CERTS`: Pfad zu einem PEM mit zusaetzlichen Root CAs (z.B. Firmen-Proxy).
- `AI_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`: Lokaler AI Provider (Ollama).
- `ALLOW_INSECURE_TLS_FOR_DEV`: Dev-only Toggle fuer TLS Workaround. Nie in Produktion aktivieren.

### Vercel Setup
1. Project in Vercel importieren.
2. Unter Settings -> Environment Variables dieselben Keys setzen.
3. Nach Aenderungen neu deployen.

Hinweis: Nach jeder Aenderung in `.env.local` den Dev Server neu starten.

## How the App Works (High-Level)

### Hauptseiten
- **Landing (/)**
  - Laedt GeoJSON Laenderdaten server-seitig.
  - Rendert den 3D-Globus client-seitig.
  - CountryPanel zeigt Wetter, Metadaten und POIs fuer das selektierte Land.
- **Map (/map)**
  - Liest `lat`, `lon`, `country`, `city` aus der URL.
  - Zentriert die Karte und zeigt POIs mit Filtern.
- **Country Detail (/country/[code])**
  - Detailseite, die das CountryPanel wiederverwendet.

### Datenquellen
- `public/data/countries.geojson` fuer Geometrien und Landgrenzen.
- `src/lib/data/countries/countries.meta.json` fuer Metadaten (Name, Hauptstadt, Population, Top Cities).
- `src/lib/data/pois/datasets/` fuer JSON POI Datasets.

## Golden Path User Flow (Step-by-step)
1. Nutzer oeffnet `/`.
2. `loadCountries()` laedt `countries.geojson` und uebergibt es an `LandingClient`.
3. `GlobeGL` rendert Laenderpolygone und gibt bei Click den Laendercode zurueck.
4. `LandingClient` setzt den State `selectedCountry`.
5. `CountryPanel` ruft:
   - `/api/weather?lat=...&lon=...`
   - `/api/pois?country=...&limit=8`
6. Nutzer klickt "Open Map":
   - `/map?lat=...&lon=...&country=...`
7. `MapPage` liest die Search Params, berechnet Zentrum und Zoom.
8. `MapView` zeigt Marker und Filter nach Kategorie.

## API Routes

### `GET /api/weather`
**Zweck:** Wetterdaten fuer Koordinaten.

**Query Params:**
- `lat` (number)
- `lon` (number)

**Beispiel:**
```
/api/weather?lat=47.3769&lon=8.5417
```

**Response (Beispiel):**
```json
{
  "provider": "openweather",
  "location": { "lat": 47.3769, "lon": 8.5417 },
  "current": {
    "tempC": 12.3,
    "description": "leichter regen",
    "icon": "10d",
    "windKph": 11,
    "humidity": 82
  },
  "daily": [
    {
      "date": "2026-01-07T12:00:00.000Z",
      "minC": 8.2,
      "maxC": 13.1,
      "icon": "04d",
      "description": "bedeckt"
    }
  ]
}
```

**Fehlerantwort:**
```json
{
  "error": "Weather service is temporarily unavailable",
  "message": "Weather service is temporarily unavailable",
  "code": "provider_error",
  "upstreamHint": "ssl_error",
  "debugId": "b7ab7b3a-6ae4-49fe-8a40-3a96f7c2d158"
}
```

**Caching:** 10 Minuten via `unstable_cache`. Fehlgeschlagene Calls werden nicht gecached.

### `GET /api/pois`
**Zweck:** Liefert kuratierte POIs aus JSON Datasets.

**Query Params:**
- `country` (ISO-2)
- `city` (cityId)
- `lat`, `lon` (fuer bbox Auswahl)
- `limit` (number)
- `category` (all|landmarks|museums|food|nightlife|nature|other)

**Beispiel:**
```
/api/pois?country=DE&limit=3
```

**Response (Beispiel):**
```json
[
  {
    "id": "country-de-brandenburg-gate",
    "name": "Brandenburg Gate",
    "category": "landmarks",
    "lat": 52.5163,
    "lon": 13.3777,
    "source": "static",
    "countryCode": "DE"
  }
]
```

**Fehlerantwort:**
```json
{ "error": "Invalid category", "code": "bad_request" }
```

**Hinweis:** Wenn ein Dataset nicht existiert, wird ein leeres Array geliefert.

### `GET /api/static-places` (deprecated)
**Zweck:** Legacy Alias fuer POIs mit `lat/lon`.

**Beispiel:**
```
/api/static-places?lat=47.3769&lon=8.5417&limit=12
```

### `GET /api/places` (deprecated)
**Zweck:** Legacy Alias fuer `/api/pois`.

### `GET /api/geocode`
**Zweck:** Geocoding via Photon.

**Query Params:**
- `q` (string)

**Beispiel:**
```
/api/geocode?q=zurich
```

**Response (Beispiel):**
```json
[
  { "name": "Zurich", "country": "Switzerland", "type": "city", "lat": 47.3769, "lon": 8.5417 }
]
```

**Caching:** 7 Tage via `unstable_cache`.

## POIs System

### Was ist ein POI?
Ein POI ist ein JSON Objekt mit stabiler ID, Kategorie und Koordinaten.

**Schema (vereinfacht):**
```json
{
  "id": "city-berlin-brandenburg-gate",
  "name": "Brandenburg Gate",
  "category": "landmarks",
  "lat": 52.5163,
  "lon": 13.3777,
  "source": "static",
  "countryCode": "DE",
  "cityId": "berlin"
}
```

### Dataset Pfade
- `src/lib/data/pois/datasets/cities/*.json`
- `src/lib/data/pois/datasets/countries/*.json`
- optional: `src/lib/data/pois/datasets/global.sample.json` (Demo)

### Auswahl-Logik
1. `city` Param -> City Dataset
2. `country` Param -> Country Dataset
3. `lat/lon` -> erste City Dataset mit passender bbox
4. Kein Match -> leeres Array

### Kategorien
`all`, `landmarks`, `museums`, `food`, `nightlife`, `nature`, `other`

### Neue City Dataset hinzufuegen
1. JSON Datei erstellen in `src/lib/data/pois/datasets/cities/`.
2. Registry Eintrag in `src/lib/data/pois/registry.ts` mit `center` und optionaler `bbox`.
3. JSON gegen `src/lib/data/pois/schema.ts` validieren (Felder + `source: "static"`).
4. Test:
   - `/api/pois?city=berlin`
   - `/map?city=berlin&lat=52.52&lon=13.405`

### Neue Country Dataset hinzufuegen
1. JSON Datei in `src/lib/data/pois/datasets/countries/` (ISO-2 Dateiname).
2. Registry Eintrag in `src/lib/data/pois/registry.ts`.
3. Test:
   - `/api/pois?country=DE`
   - `/map?country=DE&lat=52.52&lon=13.405`

## Key Files Overview (Top 15)
- `src/app/layout.tsx` - Root Layout, Fonts und globale Styles.
- `src/app/(marketing)/page.tsx` - Landing Page Einstiegspunkt.
- `src/components/landing/LandingClient.tsx` - UI State und Glue zwischen Globe, Panel und Search.
- `src/components/globe/GlobeGL.tsx` - globe.gl Rendering und Selection Events.
- `src/components/panels/CountryPanel.tsx` - Wetter und POIs im Panel.
- `src/app/map/page.tsx` - Map Seite, Search Params und POI Load.
- `src/components/map/MapView.tsx` - MapLibre Rendering, Filter, Marker.
- `src/app/api/weather/route.ts` - Wetter API, Cache, Error Mapping.
- `src/app/api/pois/route.ts` - POI API, Parameter Parsing.
- `src/app/api/geocode/route.ts` - Geocoding API (Photon).
- `src/lib/services/errors.ts` - ServiceError, requireEnv, Error Response.
- `src/lib/services/weather/openweather.ts` - OpenWeather Adapter.
- `src/lib/countries/loadCountries.ts` - GeoJSON Loader mit Revalidate.
- `src/lib/data/pois/index.ts` - POI Resolver und Filterlogik.
- `src/lib/data/pois/registry.ts` - Dataset Registry mit bbox Auswahl.

## Common Issues & Troubleshooting
- **Weather 401 / Missing key:** `OPENWEATHER_API_KEY` fehlt oder ist falsch. `.env.local` pruefen und Dev Server neu starten.
- **"Unexpected service error":** Server Log pruefen. `ServiceError` details werden im Server geloggt.
- **SSL Fehler (UNABLE_TO_GET_ISSUER_CERT_LOCALLY):**
  - Exportiere das Firmen-Root-Zertifikat als PEM.
  - Setze `NODE_EXTRA_CA_CERTS=C:\path\to\corp-root.pem`.
  - Terminal neu starten und `npm run dev` erneut starten.
  - `ALLOW_INSECURE_TLS_FOR_DEV=1` ist nur fuer lokale Entwicklung und nicht empfohlen.
  - Kurztest: ueber Handy-Hotspot pruefen, ob der Proxy/CA das Problem ist.
- **Windows curl.exe Fehler (Schannel):** Verwende Browser oder PowerShell `irm` statt `curl.exe`.
- **/map Search Params:** In Next.js App Router kann `searchParams` ein Promise sein. Immer via `await Promise.resolve(searchParams ?? {})` lesen.
- **"No curated POIs yet":** Es gibt kein passendes Dataset. JSON anlegen und in `registry.ts` registrieren.
- **Performance:** Keine riesigen globalen JSON Datasets. Klein halten und lazy imports nutzen.

## Production / Deployment (Vercel)
1. Repo in Vercel importieren.
2. Environment Variables setzen (siehe oben).
3. Build Command: `npm run build`.
4. Start Command: `npm run start` (Vercel nutzt Next default).

**Caching Hinweise:**
- `/api/weather` cached 10 Minuten.
- `/api/geocode` cached 7 Tage.
- `countries.geojson` wird server-seitig mit 1 Tag revalidated.

## Roadmap / Ideas
- Mehr kuratierte City und Country Datasets.
- Bessere Centroid Berechnung fuer Laender (z.B. label coordinates).
- POI Details (Bilder, Oeffnungszeiten, Routenplanung).
- Offline Modus fuer JSON Daten.

# Global Travel Atlas (aroundtheworld)

Eine interaktive Reise-App mit **3D-Globus**, **Live-Wetter** und **kuratierten Orten (POIs)**.  
Du kannst Laender auf dem Globus anklicken, sofort Wetter + Highlights sehen und mit der Kartenansicht (/map) Orte filtern und planen.

---

## Inhalt

- [Was ist das Projekt?](#was-ist-das-projekt)
- [Features](#features)
- [Tech-Stack](#tech-stack)
- [Schnellstart](#schnellstart)
- [Umgebungsvariablen (.env)](#umgebungsvariablen-env)
- [Projektstruktur](#projektstruktur)
- [Wie der Ablauf funktioniert](#wie-der-ablauf-funktioniert)
- [API Routes](#api-routes)
- [Datenquellen](#datenquellen)
- [POIs verstehen und erweitern](#pois-verstehen-und-erweitern)
- [Tests](#tests)
- [Deployment (Vercel)](#deployment-vercel)
- [Troubleshooting](#troubleshooting)
- [Sicherheit](#sicherheit)
- [Roadmap-Ideen](#roadmap-ideen)

---

## Was ist das Projekt?

**Global Travel Atlas** ist eine Next.js App, die dir Reiseplanung „visuell“ macht:

- **Globus statt Liste**: Du erkundest Laender per 3D-Globus.
- **Sofort Informationen**: Nach Klick bekommst du Wetter + Highlights.
- **Kartenmodus**: In `/map` siehst du Marker, kannst Kategorien filtern und Orte schnell vergleichen.
- **Lokale Datensaetze fuer POIs**: Fuer bestimmte Regionen (z.B. Paris/Zuerich/Mumbai) werden POIs aus JSON geladen. Wenn nichts passt, gibt es ein globales Fallback-Dataset.

---

## Features

- 3D-Globus mit Hover (Preview) und Click (Focus)
- Country Panel:
  - Hauptstadt + Bevoelkerung (wenn vorhanden)
  - Live-Wetter (OpenWeather: current + forecast)
  - Orte/Highlights (POIs)
- MapLibre Karte:
  - Marker fuer POIs
  - Filter nach Kategorien (landmarks, museums, food, nightlife, nature, other)
- API Routes (Next Route Handlers) inkl. Caching (unstable_cache)
- Test-Setup (Vitest + Playwright)

---

## Tech-Stack

- **Next.js 16** (App Router) + **TypeScript**
- **React 19**
- **Tailwind CSS v4** + **shadcn/ui** (Radix UI Komponenten)
- 3D: **globe.gl** + **three**
- Karte: **react-map-gl (MapLibre)** + **maplibre-gl**
- Animation: **framer-motion**
- Tests: **vitest** (Unit) + **playwright** (E2E)

---

## Schnellstart

### 1) Installieren
```bash
npm install
```

### 2) .env.local erstellen
Erstelle im Projekt-Root eine Datei **.env.local** (siehe Abschnitt „Umgebungsvariablen“).

### 3) Dev-Server starten
```bash
npm run dev
```

Dann im Browser:
- Startseite (Globus): `http://localhost:3000/`
- Kartenmodus: `http://localhost:3000/map`

---

## Umgebungsvariablen (.env)

### Minimal (empfohlen)
Lege eine Datei **.env.local** an:

```bash
# Provider
WEATHER_PROVIDER=openweather
GEOCODING_PROVIDER=photon
PLACES_PROVIDER=opentripmap

# Keys (NIE committen!)
OPENWEATHER_API_KEY=YOUR_OPENWEATHER_KEY
OPENTRIPMAP_API_KEY=YOUR_OPENTRIPMAP_KEY

# Defaults
NEXT_PUBLIC_DEFAULT_UNITS=metric
NEXT_PUBLIC_DEFAULT_LANG=de

# Optional: Default Map Center (z.B. Zuerich)
NEXT_PUBLIC_DEFAULT_LAT=47.3769
NEXT_PUBLIC_DEFAULT_LON=8.5417

# Optional: MapLibre Style (fallback ist demotiles)
NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
```

### Wichtige Hinweise
- **.env.local** ist in `.gitignore` bereits ausgeschlossen (gut).
- In deinem ZIP lagen echte Keys in `.env.local.example`. Das ist **nicht ideal**:
  - Verwende in `.env.local.example` nur Platzhalter (`YOUR_KEY_HERE`)
  - Falls diese Keys jemals „nach draussen“ kamen: **Keys rotieren** (neu erstellen)

---

## Projektstruktur

Die wichtigsten Ordner:

- `src/app/` – Routen (App Router) + API Routes
- `src/components/` – UI Komponenten (Globus, Panel, Map, Search)
- `src/lib/` – Domain-Logik, Services, Daten (POIs, Countries, Provider)
- `public/data/countries.geojson` – GeoJSON fuer alle Laender (Polygone)

### Wichtige Dateien (Top 10)
Wenn du das Projekt wirklich verstehen willst, starte hier:

1. `src/app/(marketing)/page.tsx` – Landing (Server) laedt Countries
2. `src/components/landing/LandingClient.tsx` – Glue-Code: State, Globus, Panel, Search
3. `src/components/globe/GlobeGL.tsx` – 3D Globus (Hover/Click)
4. `src/components/panels/CountryPanel.tsx` – Wetter + POIs Panel (Custom Hooks)
5. `src/app/api/weather/route.ts` – Wetter API (Caching)
6. `src/lib/services/weather/openweather.ts` – OpenWeather Integration + Mapping
7. `src/app/api/static-places/route.ts` – Static POIs API
8. `src/lib/data/pois/index.ts` – Dataset-Auswahl, Filter, Distanz-Sortierung
9. `src/lib/data/pois/regions.ts` – Bounding Boxes → welches Dataset gilt wo?
10. `src/components/map/MapView.tsx` + `src/app/map/page.tsx` – Map Mode (Server->Client)

---

## Wie der Ablauf funktioniert

### A) Startseite (Globus)
1. `src/app/(marketing)/page.tsx` ruft serverseitig `loadCountries()` auf.
2. `loadCountries()` laedt `public/data/countries.geojson` ueber HTTP (mit Revalidate).
3. `LandingClient` rendert:
   - `GlobeGL` (client-only, WebGL)
   - `CountryPanel` (zeigt Details zum ausgewaehlten Land)
   - `GlobalSearch` (lokale Suche in Country/City Index)

### B) Auswahl eines Landes
1. In `GlobeGL`:
   - Hover zeigt Tooltip (Landname).
   - Click ruft `onSelectCountry(code)` auf.
2. In `LandingClient`:
   - `selectedCountry` wird gesetzt (GeoJSON Center + Meta aus `countryMetaByCode`).
3. `CountryPanel` startet zwei Requests:
   - Wetter: `/api/weather?lat=...&lon=...`
   - Orte: `/api/static-places?lat=...&lon=...&limit=8`

### C) Kartenmodus `/map`
1. `src/app/map/page.tsx` ist Server Component:
   - bestimmt das Center (Query `?lat&lon` oder Default).
   - laedt POIs serverseitig: `getStaticPoisForCenter(center)`
2. `MapView` zeigt Karte + Marker + Filter + Liste.

---

## API Routes

### `GET /api/weather?lat=...&lon=...`
- Datei: `src/app/api/weather/route.ts`
- Holt Wetter via OpenWeather Service (`src/lib/services/weather/openweather.ts`)
- Caching: `unstable_cache(..., { revalidate: 600 })` → ca. 10 Minuten

**Antwortformat (vereinfacht):**
```json
{
  "provider": "openweather",
  "location": { "lat": 47.3, "lon": 8.5 },
  "current": { "tempC": 5.2, "description": "leicht bewoelkt", "icon": "02d" },
  "daily": [ { "date": "...", "minC": 1, "maxC": 7, "icon": "03d" } ]
}
```

### `GET /api/static-places?lat=...&lon=...&limit=...&category=...`
- Datei: `src/app/api/static-places/route.ts`
- Gibt POIs aus lokalen JSON-Datasets zurueck (Paris/Zuerich/Mumbai/Global Sample)

### `GET /api/places?lat=...&lon=...`
- Datei: `src/app/api/places/route.ts`
- Aktuell praktisch identisch zu `static-places` (Legacy / zweite Route).

### `GET /api/geocode?q=...`
- Datei: `src/app/api/geocode/route.ts`
- Nutzt `getGeocodingService()` (default: Photon)
- Caching: 7 Tage Revalidate (weil Geocoding selten aendert)

---

## Datenquellen

### 1) Laender (GeoJSON)
- Datei: `public/data/countries.geojson`
- Wird fuer:
  - 3D-Polygone auf dem Globus
  - Country Center Berechnung (`getFeatureCenter`)
  - Namen/ISO Codes Mapping

### 2) Kuratierte Country-Meta
- Datei: `src/lib/countries/countryMeta.ts`
- Enthalten (je nach Land):
  - `capital`, `population`
  - `topCities` (Badges)
  - `topPlaces` (Fallback-Hits)

### 3) POIs (lokale Datensaetze)
- Ordner: `src/lib/data/pois/datasets/*.json`
- Beispiele:
  - `paris.json`
  - `zurich.json`
  - `mumbai.json`
  - `global.sample.json`

Diese POIs haben echte Koordinaten und werden nach Distanz zum aktuellen Center sortiert.

---

## POIs verstehen und erweitern

### Was sind POIs?
POI = **Point of Interest** → „interessanter Ort“ (z.B. Museum, Restaurant, Aussichtspunkt).

Im Code sind POIs Objekte mit z.B.:
- `id`, `name`
- `category` (landmarks/museums/food/nightlife/nature/other)
- `lat`, `lon`
- optional `rating`, `address`, `imageUrl`
- `source` (bei static datasets muss `source: "static"` sein)

### Wie wird entschieden, welches Dataset gilt?
- Datei: `src/lib/data/pois/regions.ts`
- Jede Region hat eine **Bounding Box** (min/max Lat/Lon).
- Wenn dein Center in der Box liegt → dieses Dataset wird geladen.
- Sonst → `fallbackRegion` (global.sample).

### Wie werden POIs gefiltert und sortiert?
- Datei: `src/lib/data/pois/index.ts`
- Schritte:
  1. Region finden (`findRegionForCenter`)
  2. Dataset dynamisch importieren
  3. Validieren (`parseStaticPois`)
  4. Optional nach `category` filtern
  5. Nach Distanz sortieren (Haversine)
  6. `limit` anwenden

### Neue Stadt/Region hinzufuegen (Schritt fuer Schritt)
1. Neues Dataset erstellen, z.B.:
   - `src/lib/data/pois/datasets/berlin.json`
2. Struktur wie bestehende Datensaetze verwenden (wichtig: `source: "static"`).
3. Region in `src/lib/data/pois/regions.ts` ergaenzen:

```ts
{
  id: "berlin",
  label: "Berlin",
  bbox: { minLat: 52.3, minLon: 13.0, maxLat: 52.7, maxLon: 13.8 },
  dataset: async () =>
    (await import("./datasets/berlin.json")).default as StaticPOI[],
}
```

4. Testen:
   - `http://localhost:3000/map?lat=52.52&lon=13.405`

---

## Tests

Unit Tests (Vitest):
```bash
npm run test
```

Watch Mode:
```bash
npm run test:watch
```

E2E Tests (Playwright):
```bash
npm run test:e2e
```

---

## Deployment (Vercel)

1. Repo zu Vercel verbinden
2. In Vercel → Project → **Environment Variables** setzen:
   - `OPENWEATHER_API_KEY`
   - `OPENTRIPMAP_API_KEY`
   - optional: `NEXT_PUBLIC_DEFAULT_LAT/LON`, `NEXT_PUBLIC_MAP_STYLE_URL`
3. Build:
   - `npm run build`
4. Deploy

Hinweis: `loadCountries()` versucht die Base-URL automatisch zu bestimmen (u.a. via `VERCEL_URL` oder Request-Headers). Das hilft bei SSR/Server Fetches.

---

## Troubleshooting

### Wetter zeigt „Weather data will appear...“
- `OPENWEATHER_API_KEY` fehlt oder ist falsch.
- Pruefe `.env.local` und starte `npm run dev` neu.

### Karte ist leer / keine Marker
- Du bist evtl. in einem Bereich ohne Region-Dataset → es faellt auf `global.sample.json` zurueck.
- Teste `/map?lat=48.8566&lon=2.3522` (Paris) oder `/map?lat=47.3769&lon=8.5417` (Zuerich).

### Externe Texturen (Globus) laden langsam
- `GlobeGL` nutzt aktuell Assets von `unpkg.com`. Bei Bedarf in `public/` speichern und lokal ausliefern.

---

## Sicherheit

- **Keine API Keys committen** (auch nicht in `.env.local.example`).
- Wenn Keys schon im Repo/ZIP waren: **rotieren** (neue erstellen, alte ungueltig machen).
- Nutze fuer Vercel immer Environment Variables (Production/Preview getrennt).

---

## Roadmap-Ideen

- GlobalSearch erweitern: bei „kein Treffer“ → `/api/geocode` als Fallback nutzen
- `/api/places` wirklich mit OpenTripMap Provider verbinden (hybrid: lokal → fallback extern)
- Mehr POI-Datasets (Staedte/Regionen) hinzufuegen
- Country Detail Page ausbauen (`/country/[code]`) mit „Itinerary“, „Budget“, „Best season“
- Offline-first: caching der Datasets und zuletzt besuchten Laender/Orte

---

Viel Spass beim Weiterbauen! 🙂
