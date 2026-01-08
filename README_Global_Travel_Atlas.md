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

# Optional: Weather request timeout (ms)
OPENWEATHER_TIMEOUT_MS=8000

# Optional: Corporate proxy CA bundle
NODE_EXTRA_CA_CERTS=C:\path\to\corp-ca.pem

# Optional: Dev-only TLS fallback (never enable in production)
ALLOW_INSECURE_SSL=false

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
7. `src/app/api/pois/route.ts` - POI API (country/city/lat/lon)
8. `src/lib/data/pois/index.ts` - Dataset-Auswahl, Filter, Distanz-Sortierung
9. `src/lib/data/pois/registry.ts` - City/Country Datasets + BBoxes
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
   - Orte: `/api/pois?country=...&lat=...&lon=...&limit=8` (lat/lon fuer Sortierung)

### C) Kartenmodus `/map`
1. `src/app/map/page.tsx` ist Server Component:
   - bestimmt das Center (Query `?lat&lon` oder Default).
   - laedt POIs serverseitig: `getPoisForMap({ lat, lon, country, city })`
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
Optional: `errors` kann gesetzt sein, wenn Forecast ausfaellt.

### `GET /api/pois?country=...&city=...&lat=...&lon=...&limit=...&category=...`
- Datei: `src/app/api/pois/route.ts`
- Selector: country/city/lat/lon (mindestens eins), optional `category`
- Kategorien: all, landmarks, museums, food, nightlife, nature, other

### `GET /api/static-places?lat=...&lon=...&limit=...&category=...`
- Datei: `src/app/api/static-places/route.ts`
- Deprecated Alias fuer `/api/pois` (lat/lon required)

### `GET /api/places?lat=...&lon=...`
- Datei: `src/app/api/places/route.ts`
- Deprecated Alias fuer `/api/pois` (Legacy Route).

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
- Datei: `src/lib/data/pois/registry.ts`
- `cityDatasets` definieren BBoxes, `countryDatasets` sind ISO-Codes.
- Auswahl in `getPoisForMap` (`src/lib/data/pois/index.ts`):
  - city param -> city dataset
  - country param -> country dataset
  - lat/lon -> city dataset per bbox

### Wie werden POIs gefiltert und sortiert?
- Datei: `src/lib/data/pois/index.ts`
- Schritte:
  1. Dataset waehlen (city/country/lat-lon)
  2. Dataset dynamisch importieren
  3. Validieren (`parsePoisDataset`)
  4. Optional nach `category` filtern
  5. Optional nach Distanz sortieren (Haversine)
  6. `limit` anwenden

### Neue Stadt/Region hinzufuegen (Schritt fuer Schritt)
1. Neues Dataset erstellen, z.B.:
   - `src/lib/data/pois/datasets/berlin.json`
2. Struktur wie bestehende Datensaetze verwenden (wichtig: `source: "static"`).
3. City-Dataset in `src/lib/data/pois/registry.ts` ergaenzen:

```ts
berlin: {
  id: "berlin",
  center: { lat: 52.52, lon: 13.405 },
  bbox: { minLat: 52.3, minLon: 13.0, maxLat: 52.7, maxLon: 13.8 },
  loader: async () =>
    (await import("./datasets/cities/berlin.json")).default as POI[],
},
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

### Wetter zeigt "Weather data will appear..."
- `OPENWEATHER_API_KEY` fehlt oder ist falsch.
- Nach dem Setzen `npm run dev` neu starten.
- `/api/weather` liefert 401/403 -> API key ungueltig oder nicht aktiviert.
- `/api/weather` liefert 429 -> Rate Limit erreicht (abwarten oder Plan upgraden).
- Bei Timeouts: `OPENWEATHER_TIMEOUT_MS` (z.B. 10000) setzen und neu starten.

### SSL/Proxy Fehler (UNABLE_TO_GET_ISSUER_CERT_LOCALLY)
- Setze `NODE_EXTRA_CA_CERTS` auf den Pfad deiner Corporate-CA und starte neu.
- Dev-only fallback: `ALLOW_INSECURE_SSL=true` (niemals in Produktion).

### Karte ist leer / keine Marker
- Fuer viele Regionen gibt es (noch) keine lokalen POI-Datasets.
- Teste `/map?lat=48.8566&lon=2.3522` (Paris) oder `/map?lat=47.3769&lon=8.5417` (Zuerich).

### Externe Texturen (Globus) laden langsam
- `GlobeGL` nutzt lokale Texturen in `public/textures`. Stelle sicher, dass sie vorhanden sind.

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



