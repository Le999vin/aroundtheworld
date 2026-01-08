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

# Optional: Dev-only SSL fallback (NICHT in Produktion)
ALLOW_INSECURE_SSL=false
```

### Warum diese Variablen
- `OPENWEATHER_API_KEY`: notwendig fuer `/api/weather`.
- `WEATHER_PROVIDER`, `GEOCODING_PROVIDER`: Auswahl der Provider.
- `NEXT_PUBLIC_DEFAULT_LAT/LON`: Default Zentrum fuer `/map`.
- `NEXT_PUBLIC_DEFAULT_UNITS`, `NEXT_PUBLIC_DEFAULT_LANG`: Wetter Einheiten und Sprache.
- `NEXT_PUBLIC_MAP_STYLE_URL`: optionaler MapLibre Style.
- `NODE_EXTRA_CA_CERTS`: Pfad zu einem PEM mit zusaetzlichen Root CAs (z.B. Firmen-Proxy).
- `ALLOW_INSECURE_SSL`: Dev-only Toggle fuer SSL Workaround. Nie in Produktion aktivieren.

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
  - `ALLOW_INSECURE_SSL=true` ist nur fuer lokale Entwicklung und nicht empfohlen.
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
