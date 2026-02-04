# AroundTheWorld – Developer Documentation

## Übersicht

**AroundTheWorld** (Global Travel Atlas) ist eine Next.js-Anwendung, die Benutzerinnen und Benutzer Länder auf einem 3D-Globus erkunden lässt, kuratierte POIs aus lokalen Datensätzen anzeigt und eine interaktive Karte mit Filter, Reiseplanung, Unterkünften sowie Live-Wetterdaten bietet. Ein Atlas Assistant (Ollama) liefert Chat-Antworten und Intents im Country-Panel.

---

## 1. Schnelleinstieg

### Voraussetzungen
- **Node.js** und **npm**

### Installation
```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Entwicklungsserver starten (predev generiert die POI-Registry)
npm run build        # Produktions-Build (prebuild generiert die POI-Registry)
npm run start        # Produktions-Server
```

### Wichtige Befehle
```bash
npm run lint                # Code-Stil prüfen
npm run test                # Unit-Tests ausführen
npm run test:watch          # Tests im Watch-Modus
npm run test:e2e            # End-to-End Tests
npm run pois:fix            # POI-Datensätze normalisieren
npm run pois:validate       # POI-Datensätze validieren
```

### Umgebungsvariablen

Erstelle eine `.env.local` für Provider-Konfiguration und optionale Defaults.

#### Runtime (App)

| Variable | Erforderlich | Beispiel | Zweck |
|----------|-------------|----------|-------|
| `OPENWEATHER_API_KEY` | Ja (Wetter) | `YOUR_KEY` | OpenWeather API-Schlüssel für `/api/weather`. |
| `WEATHER_PROVIDER` | Optional | `openweather` | Wetter-Provider (nur `openweather` implementiert). |
| `OPENWEATHER_TIMEOUT_MS` | Optional | `8000` | Timeout in ms für OpenWeather-Requests. |
| `ALLOW_INSECURE_TLS_FOR_DEV` | Optional | `1` | Erlaubt unsichere TLS-Zertifikate in Dev. |
| `ALLOW_INSECURE_TLS` | Optional | `1` | Alias für unsichere TLS in Dev. |
| `ALLOW_INSECURE_SSL` | Optional | `1` | Alias für unsichere TLS in Dev. |
| `NODE_EXTRA_CA_CERTS` | Optional | `C:\\ca.pem` | Pfad zu einer eigenen CA-Datei. |
| `NEXT_PUBLIC_DEFAULT_UNITS` | Optional | `metric` | Standard-Einheiten für Wetter (`imperial` für US). |
| `NEXT_PUBLIC_DEFAULT_LANG` | Optional | `de` | Sprache für Wettertexte. |
| `NEXT_PUBLIC_DEFAULT_LAT` | Optional | `47.3769` | Standard-Kartenmittelpunkt (Latitude). |
| `NEXT_PUBLIC_DEFAULT_LON` | Optional | `8.5417` | Standard-Kartenmittelpunkt (Longitude). |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Optional | MapLibre Style JSON | Kartenstil; leer => MapLibre Demo-Style. |
| `NEXT_PUBLIC_SITE_URL` | Optional | `https://example.com` | Basis-URL für serverseitiges Laden von `/data/countries.geojson`. |
| `SITE_URL` | Optional | `https://example.com` | Alternative Basis-URL (Server). |
| `VERCEL_URL` | Optional | `my-app.vercel.app` | Wird zu `https://...` erweitert, wenn keine Basis-URL gesetzt ist. |
| `GEOCODING_PROVIDER` | Optional | `photon` | Geocoding-Provider (nur `photon` implementiert). |
| `PLACES_PROVIDER` | Optional | `opentripmap` | Places-Provider (nur `opentripmap` implementiert; `/api/places` ist deprecated). |
| `OPENTRIPMAP_API_KEY` | Nur falls OpenTripMap genutzt wird | `YOUR_KEY` | API-Key für den OpenTripMap-Service. |
| `STAYS_PROVIDER` | Optional | `mock` | Stays-Provider: `mock` oder `partner`. |
| `STAYS_PARTNER_ENDPOINT` | Nur falls `STAYS_PROVIDER=partner` | `https://partner.example.com/stays` | Partner-API Endpoint. |
| `STAYS_PARTNER_KEY` | Nur falls `STAYS_PROVIDER=partner` | `sk_...` | Partner-API Key. |
| `NOMINATIM_USER_AGENT` | Optional | `GlobalTravelAtlas/1.0 (contact: https://example.com)` | User-Agent für `/api/poi-details` (Default ist gesetzt). |
| `AI_PROVIDER` | Optional | `ollama` | KI-Provider für `/api/ai` (nur `ollama` akzeptiert). |
| `OLLAMA_BASE_URL` | Optional | `http://127.0.0.1:11434` | Ollama Server Basis-URL. |
| `OLLAMA_URL` | Optional | `http://127.0.0.1:11434` | Alias für `/api/ai/chat` (hat Vorrang vor `OLLAMA_BASE_URL`). |
| `OLLAMA_MODEL` | Optional | `llama3.1:8b` | Ollama Modell. |
| `NODE_ENV` | Optional (von Next gesetzt) | `development` | Schaltet Dev/Prod-Logik (Logging, Caches). |

#### Skripte/Tests

| Variable | Erforderlich | Beispiel | Zweck |
|----------|-------------|----------|-------|
| `ENABLE_GEOCODE` | Optional | `1` | Aktiviert Nominatim-Geocoding in `scripts/merge-all-pois.ts`. |
| `NOMINATIM_USER_AGENT` | Optional | `GlobalTravelAtlas/1.0 (contact: https://example.com)` | Wird auch von Merge-Skripten genutzt. |
| `AIML_API_KEY` | Ja (test-aimlapi) | `YOUR_KEY` | API-Key für `scripts/test-aimlapi.mjs`. |
| `AIML_API_BASE_URL` | Optional | `https://api.aimlapi.com/v1` | Basis-URL für `scripts/test-aimlapi.mjs`. |
| `AIML_MODEL` | Optional | `gpt-4o-mini` | Modell für `scripts/test-aimlapi.mjs`. |
| `AIML_MAX_TOKENS` | Optional | `128` | Max Tokens für `scripts/test-aimlapi.mjs`. |
| `LOCAL_AI_URL` | Optional | `http://localhost:3000/api/ai` | Ziel für `scripts/test-local-ai.mjs`. |

---

## 2. Projekt-Struktur

### Hauptverzeichnisse

```
aroundtheworld/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (marketing)/        # Landing Page
│   │   ├── map/                # Karten-Seite
│   │   ├── country/[code]/     # Land-Details
│   │   └── api/                # API-Routen
│   ├── components/             # React UI-Komponenten
│   ├── lib/                    # Business-Logik & Services
│   └── styles/                 # Globale Styles
├── public/
│   ├── data/                   # GeoJSON & Datensätze
│   └── textures/               # Globe-Texturen
├── scripts/                    # Build & Daten-Scripts
├── docs/                       # Dokumentation
└── package.json
```

### Wichtige Dateien

| Pfad | Zweck |
|------|--------|
| `src/app/(marketing)/page.tsx` | Landing Page mit 3D-Globus |
| `src/app/map/page.tsx` | Map-Seite mit initialen POIs |
| `src/app/country/[code]/page.tsx` | Länder-Detailseite |
| `src/components/globe/GlobeGL.tsx` | 3D-Globus Rendering & Länder-Auswahl |
| `src/components/map/MapView.tsx` | MapLibre-Karte mit POIs, Stays und Itinerary |
| `src/components/panels/CountryPanel.tsx` | Country-Panel (Wetter, Flüge, POIs, Chat) |
| `src/components/ai/AtlasChat.tsx` | Atlas Assistant UI |
| `src/components/itinerary/ItineraryWidget.tsx` | Reiseplanung & Routenoptimierung |
| `src/app/api/poi-details/route.ts` | POI-Details Enrichment |
| `src/app/api/atlas-assistant/route.ts` | Atlas Assistant API |
| `src/lib/data/pois/index.ts` | POI-Datenverwaltung |
| `src/lib/services/weather/openweather.ts` | Wetter-Integration |

---

## 3. Architektur-Übersicht

### Datenfluss

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Benutzer-Interface (React)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│        3D-Globus        │        Karte        │   Country-Panel │ Atlas Chat│
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │                             │
                         ▼                             ▼
                ┌─────────────────┐           ┌──────────────────────────┐
                │     API Routes  │           │       Datenquellen       │
                ├─────────────────┤           ├──────────────────────────┤
                │ /weather        │           │ countries.geojson        │
                │ /pois           │           │ POI-JSON (cities/        │
                │ /geocode        │           │        countries/        │
                │ /poi-details    │           │        global.sample)    │
                │ /stays          │           │ countries.meta.json      │
                │ /atlas-assistant│           │ stays datasets           │
                │ /ai (/ai/chat)  │           └──────────────────────────┘
                └─────────┬───────┘
                          │
                          ▼
                ┌───────────────────────────┐
                │     Externe Services      │
                ├───────────────────────────┤
                │ OpenWeather               │
                │ Photon (Geocode)          │
                │ Nominatim / Overpass      │
                │ Wikidata / Wikipedia      │
                │ Ollama (KI)               │
                └───────────────────────────┘

```

### Hauptkomponenten

| Komponente | Funktion |
|-----------|----------|
| **GlobeGL** | 3D-Globus Rendering & Länder-Auswahl |
| **MapView** | Interaktive MapLibre-Karte mit POI-Filtern, Stays und Itinerary |
| **CountryPanel** | Wetter, Flüge, POIs und Atlas-Chat |
| **PoiDetailsDrawer** | POI-Details (Enrichment via `/api/poi-details`) |
| **ItineraryWidget** | Reiseplanung, Optimierung und Teilen |
| **AtlasChat** | KI-Assistent (Atlas Assistant) |

---

## 4. API-Routen

### `/api/weather` (GET)
**Funktionalität:** Aktuelle Wetter- und Vorhersagedaten (OpenWeather)  
**Parameter:** `lat`, `lon`, optional `allowZero=1|true`  
**Antwort:** `WeatherData` (`provider`, `location`, `current`, `daily`, `errors?`)  
**Caching:** `unstable_cache` mit `revalidate=600` (10 Minuten), Stale-Fallback im Speicher  
**Hinweis:** Einheiten und Sprache kommen aus `NEXT_PUBLIC_DEFAULT_UNITS`/`NEXT_PUBLIC_DEFAULT_LANG`.

### `/api/pois` (GET)
**Funktionalität:** Kuratierte POIs aus lokalen Datensätzen  
**Parameter:** `country` (ISO-2/ISO-3 oder Name), `city`, `lat`, `lon`, `limit`, `category` (`landmarks|museums|food|nightlife|nature|other|all`)  
**Antwort:** `POI[]` (Array)  
**Hinweis:** Es muss mindestens `country`, `city` oder `lat/lon` gesetzt sein.

### `/api/places` (GET)
**Funktionalität:** Deprecated Alias für `/api/pois` (externe Provider sind deaktiviert).

### `/api/static-places` (GET)
**Funktionalität:** Deprecated; nutzt `/api/pois` mit `lat/lon` Pflicht und `category=all`.

### `/api/stays` (GET)
**Funktionalität:** Unterkünfte im aktuellen Kartenausschnitt (Provider-basiert, kein Scraping)  
**Parameter:** `bbox=minLon,minLat,maxLon,maxLat`, optional `minPrice`, `maxPrice`, `currency`, `limit`, `country`  
**Antwort:** `{ stays: Stay[], meta: { source, fallback?, error? } }`  
**Caching:** In-Memory Cache, TTL 60 Sekunden  
**Provider:** `STAYS_PROVIDER=mock|partner` mit Mock-Fallback bei Partner-Fehlern.

### `/api/geocode` (GET)
**Funktionalität:** Adresse/Ort → Koordinaten (Photon)  
**Parameter:** `q`  
**Antwort:** `GeocodeResult[]`  
**Caching:** `unstable_cache` mit `revalidate=7 Tage`

### `/api/poi-details` (GET)
**Funktionalität:** Erweiterte POI-Informationen  
**Parameter:** `lat`, `lon`, optional `name`, `category`  
**Antwort:** `{ address, city, openingHours, website, osm, images }`  
**Quellen:** Nominatim, Overpass, Wikidata, Wikipedia  
**Caching:** In-Memory Cache in Dev; in Prod `Cache-Control: s-maxage=86400, stale-while-revalidate=604800`

### `/api/atlas-assistant` (POST)
**Funktionalität:** Atlas Assistant Chat (Ollama, JSON)  
**Body:** `{ messages, agentMode?, uiState? }`  
**Antwort:** `AtlasAssistantResponse` (`message_md`, `quick_replies?`, `intents?`)

### `/api/ai` (POST, SSE)
**Funktionalität:** Streaming-Chat mit Actions (Ollama, SSE)  
**Body:** `{ messages, context?, threadKey?, agentMode?, uiContext? }`  
**Antwort:** Server-Sent Events (`delta`, `actions`, `done`, `error`)  
**Provider:** `AI_PROVIDER=ollama` (sonst Fehler)

### `/api/ai/chat` (POST)
**Funktionalität:** TravelBot (Ollama, JSON)  
**Body:** `{ messages, appState? }`  
**Antwort:** `TravelBotResponse` (`message_md`, `quick_replies`, `state`)  
**Hinweis:** Nutzt `OLLAMA_URL` oder `OLLAMA_BASE_URL`.

---

## 5. Datenmodell

### POI-Schema

```typescript
{
  id: string                    // Eindeutige ID
  name: string                  // Name
  category: PlaceCategory       // Kategorie
  lat: number                   // Breitengrad
  lon: number                   // Längengrad
  source: "static" | "curated" | "opentripmap"
  countryCode?: string          // ISO-2/ISO-3
  cityId?: string               // Slug (z.B. "zurich")
  city?: string                 // Anzeigename
  googlePlaceId?: string
  description?: string
  address?: string
  rating?: number
  website?: string
  mapsUrl?: string
  imageUrl?: string
  images?: { url: string; source: "wikimedia" | "wikipedia"; attribution?: string }[]
  openingHours?: string
  osm?: { type: "N" | "W" | "R"; id: number }
  tags?: string[]
}
```

### Kategorien

- `landmarks` – Sehenswürdigkeiten & historische Orte
- `museums` – Museen & Galerien
- `food` – Essen & Trinken
- `nightlife` – Bars & Nightlife
- `nature` – Natur & Parks
- `other` – Sonstiges

---

## 6. POI-Datensätze

### Lokale Datensätze

POI-Datensätze sind organisiert nach:

**Nach Stadt:** `src/lib/data/pois/datasets/cities/*.json`  
Beispiele: `amsterdam.json`, `paris.json`, `tokyo.json`

**Nach Land:** `src/lib/data/pois/datasets/countries/*.json`  
Beispiele: `DE.json`, `FR.json`

**Fallback:** `src/lib/data/pois/datasets/global.sample.json` wird genutzt, wenn kein passender City- oder Country-Datensatz existiert.

### Datensatz-Registry

Die Datei `src/lib/data/pois/registry.generated.ts` wird automatisch generiert durch:
```bash
npm run predev    # vor npm run dev
npm run prebuild  # vor npm run build
```

Sie enthält:
- City-Loader mit Bounding-Boxes
- Country-Datensatz-Zuordnungen
- Koordinaten-Zentren für Zoom-Funktionen


### Mock Stays Dataset

Die Stays-API nutzt Mock-Datensätze pro Land:
- `public/data/stays/countries/<CC>.json`

Optional:
- `public/data/stays.all.json`

Fallback (Legacy):
- `public/data/stays.mock.json`

Generieren:

```bash
node scripts/generate-stays-dataset.ts --perCity=150 --radiusKm=8 --writeAll=false
```

---

## 7. Erweiterungsleitfaden

### Neues Land hinzufügen

1. **Datensatz erstellen:**
   ```bash
   touch src/lib/data/pois/datasets/countries/XX.json
   ```

2. **Format-Vorlage:**
   ```json
   [
     {
       "id": "country-xx-sample-1",
       "name": "Sehenswürdigkeit",
       "category": "landmarks",
       "lat": 51.5074,
       "lon": -0.1278,
       "source": "static",
       "countryCode": "XX",
       "city": "Hauptstadt",
       "address": "Zentrum"
     }
   ]
   ```

3. **Registry aktualisieren:**
   ```bash
   npm run predev
   ```

4. **Validieren:**
   ```bash
   npm run pois:validate
   ```

### Neue POI-Kategorie hinzufügen

1. **In `src/lib/types.ts` die Union erweitern:**
   ```typescript
   export type PlaceCategory =
     | "landmarks"
     | "museums"
     | "food"
     | "nightlife"
     | "nature"
     | "other"
     | "my_new_category";
   ```

2. **In `src/lib/data/pois/constants.ts` hinzufügen:**
   ```typescript
   export const PLACE_CATEGORIES = [
     "landmarks",
     "museums",
     "food",
     "nightlife",
     "nature",
     "other",
     "my_new_category",
   ] as const;
   ```

3. **In `src/components/map/PoiCategoryIcon.tsx` Icon ergänzen.**

### Neue API-Route erstellen

1. **Datei erstellen:** `src/app/api/myfeature/route.ts`

2. **Template:**
   ```typescript
   import { logServiceError, toErrorResponse } from "@/lib/services/errors";

   export async function GET(request: Request) {
     try {
       // Logik hier
       return Response.json({ data: result });
     } catch (error) {
       const { serviceError, status, body } = toErrorResponse(error);
       logServiceError("api/myfeature", serviceError);
       return Response.json(body, { status });
     }
   }
   ```

3. **In Component aufrufen:**
   ```typescript
   const response = await fetch("/api/myfeature?param=value");
   const data = await response.json();
   ```

---

## 8. Performance & Optimierung

### Caching-Strategien

| Route | Methode | Dauer | Grund |
|-------|---------|-------|-------|
| `/api/weather` | `unstable_cache` | 10 Minuten | Wetterdaten pro Koordinate/Units/Language cachen |
| `/api/geocode` | `unstable_cache` | 7 Tage | Geocoding ist teuer und selten ändernd |
| `/api/poi-details` | `Cache-Control` (Prod) / In-Memory (Dev) | 1 Tag + SWR 7 Tage | Externe Lookups + Bilder |
| `/api/stays` | In-Memory | 60 Sekunden | Stays-Abfragen im gleichen Viewport |

### Performance-Tipps

- POI-Details werden nur bei Bedarf nachgeladen und clientseitig gecached (Drawer).
- MapView filtert und sortiert POIs clientseitig und memoisiert teure Berechnungen.
- Das Länder-GeoJSON wird serverseitig mit `revalidate=86400` geladen.

---

## 9. Fehlerbehebung

### Problem: `npm run dev` schlägt fehl

**Ursache:** `predev` führt `node scripts/generate-poi-registry.ts` aus (TypeScript).  
**Lösung:**
```bash
# Option 1: tsx verwenden
npx tsx scripts/generate-poi-registry.ts

# Option 2: Scripts zu JavaScript konvertieren
```

### Problem: Wetter wird nicht angezeigt

**Checkliste:**
- [ ] `OPENWEATHER_API_KEY` gesetzt?
- [ ] `WEATHER_PROVIDER` = `openweather`?
- [ ] Koordinaten korrekt?
- [ ] Netzwerk-Verbindung?

**Debug:**
```bash
curl "https://api.openweathermap.org/data/2.5/weather?lat=50&lon=10&appid=YOUR_KEY"
```

### Problem: POIs fehlen in der Karte

**Lösung:**
```bash
npm run pois:validate   # Datensätze prüfen
npm run pois:fix        # Normalisieren
npm run predev          # Registry neu generieren
```

### Problem: Karte sieht leer aus

**Überprüfen:**
- `NEXT_PUBLIC_MAP_STYLE_URL` gültig?
- MapLibre-Style JSON erreichbar?
- In Dev: Konsolenwarnung zum Demo-Style beachten.

### Problem: Stays werden nicht angezeigt

**Überprüfen:**
- `STAYS_PROVIDER` gesetzt (`mock` oder `partner`)?
- `public/data/stays/countries/<CC>.json` vorhanden (Mock)?
- Bei Partner: `STAYS_PARTNER_ENDPOINT` und `STAYS_PARTNER_KEY` gesetzt?

### Problem: Atlas Assistant reagiert nicht

**Überprüfen:**
- Läuft Ollama unter `OLLAMA_BASE_URL`?
- Ist `OLLAMA_MODEL` verfügbar?

---

## 10. Tech-Stack

| Bereich | Technologie | Version |
|---------|------------|---------|
| **Framework** | Next.js | ^16.1.5 |
| **Rendering** | React | 19.2.3 |
| **Sprache** | TypeScript | ^5 |
| **Styling** | Tailwind CSS | ^4 |
| **UI-Komponenten** | Radix UI (Dialog/Slider/Slot) | ^1.1.15 / ^1.3.5 / ^1.2.4 |
| **3D-Globus** | globe.gl + three.js | ^2.45.0 + ^0.182.0 |
| **Kartierung** | MapLibre GL + react-map-gl | ^5.15.0 + ^8.1.0 |
| **Testing** | Vitest + Playwright | ^4.0.16 + ^1.57.0 |

---

## 11. Contributor-Richtlinien

### Ordnerstruktur einhalten

```
RICHTIG:
src/components/       → UI-Komponenten
src/lib/              → Business-Logik
src/app/              → Routen & Pages
scripts/              → Build-Automatisierung

FALSCH:
Root-Ebene für Komponenten
src/ für alles zusammen
```

### Workflow

1. **Branch erstellen:** `git checkout -b feature/xyz`
2. **Implementieren:** Code schreiben & testen
3. **Tests:** `npm run test` & `npm run lint`
4. **Dokumentation:** README aktualisieren
5. **PR:** Submit mit Beschreibung

### Do's & Don'ts

| Do | Don't |
|------|---------|
| POI-Registry nach Datensatz-Änderungen regenerieren | `.env.local` ins Repo committen |
| `ServiceError` für API-Fehler nutzen | API-Keys in Code hard-coden |
| Props stabil halten für Performance | Inline-Funktionen in Props |
| Unit-Tests schreiben | Breaking Changes ohne Migration |
| TypeScript-Types nutzen | `any` verwenden |

---

## 12. Weitere Ressourcen

**Dokumentation:**
- `README.md` – Quickstart auf Deutsch
- `docs/project-analysis.md` – Technische Audit
- `docs/poi-maps-enrichment.todo.md` – Enhancement Backlog

**Externe APIs:**
- [OpenWeather API](https://openweathermap.org/api)
- [Photon Geocoding](https://photon.komoot.io/)
- [Nominatim (OSM)](https://nominatim.org/)
- [Overpass API](https://overpass-api.de/)
- [Wikidata](https://www.wikidata.org/)
- [Wikipedia REST API](https://www.mediawiki.org/wiki/REST_API)
- [Ollama](https://ollama.com/)
- [OpenTripMap](https://opentripmap.com/api) (optional, Places-Service)

**Development Tools:**
- `vitest` – Unit Testing
- `playwright` – E2E Testing
- `eslint` – Code Linting

---

## 13. Feature Flows & Code Walkthrough (Deep Dive)

### 13.1 "Big Picture" Feature Map

| Feature | Entry Point | Primary Components | API Routes | Core Services | External Services | Notes |
|---------|------------|-------------------|-----------|----------------|------------------|-------|
| **Landing + Globe Selection** | `src/app/(marketing)/page.tsx` | `LandingClient`, `GlobeGL` | — | `loadCountries`, `countryMeta`, `geo` | — | Focus set from Globe-Click. Link to `/map` available. |
| **Country Panel** | `src/components/panels/CountryPanel.tsx` | `CountryPanel`, `AtlasChat`, `ChatSheet` | `/api/weather`, `/api/pois`, `/api/geocode`, `/api/atlas-assistant` | `weather`, `pois`, `geocoding`, `flights`, `ai` | OpenWeather, Photon, Ollama, Google Flights | Weather/POIs loaded on demand; Chat embedded. |
| **Map + POIs** | `src/app/map/page.tsx` | `MapView`, `PoiDetailsDrawer`, `ItineraryWidget` | `/api/poi-details`, `/api/stays` | `pois`, `itinerary`, `stays` | Nominatim, Overpass, Wikidata, Wikipedia, Partner API | POIs server-loaded; interactions client-side. |
| **POI Details Enrichment** | `src/components/map/PoiDetailsDrawer.tsx` | `PoiDetailsDrawer` | `/api/poi-details` | `poi-details` route | Nominatim, Overpass, Wikidata, Wikipedia | Lazy-loaded; cached per POI-ID. |
| **Atlas Assistant Chat** | `src/components/ai/AtlasChat.tsx` | `AtlasChat` | `/api/atlas-assistant` | `atlasAgent.store`, `atlasAssistant` | Ollama | History persisted in LocalStorage. |
| **Stays (Accommodations)** | `src/components/map/MapView.tsx` | `MapView` (Stays Layer) | `/api/stays` | `stays`, `providers` | Partner API or Mock Data | Debounced; in-memory cache (60s TTL). |
| **Itinerary Planning + Share** | `src/components/itinerary/ItineraryWidget.tsx` | `ItineraryWidget` | `/api/geocode` | `itinerary/store`, `itinerary/optimize`, `itinerary/share` | Google Directions | Share URL: `map?itinerary=...` |
| **Geocoding Search** | `src/components/panels/CountryPanel.tsx`, `ItineraryWidget` | `CountryPanel`, `ItineraryWidget` | `/api/geocode` | `GeocodeService` → `PhotonGeocodingService` | Photon | 7-day cache revalidation. |

---

### 13.2 Sequence Flows

#### **Flow A: Landing → Globe Selection → Country Panel**

```
User
   ↓
GET / (LandingPage)
   ↓
loadCountries() → /data/countries.geojson
   ↓
LandingClient → GlobeGL.onPolygonClick
   ↓
setFocus → CountryPanel updates
```

**References:** `src/app/(marketing)/page.tsx:5`, `src/lib/countries/loadCountries.ts:23`, `src/components/landing/LandingClient.tsx:322`

---

#### **Flow B: Map → Load POIs → Filter → Click → Details**

```
User
   ↓
GET /map (MapPage)
   ↓
getPoisForMap() → POI datasets
   ↓
MapView renders Markers + Filters
   ↓
POI Click → PoiDetailsDrawer
   ↓
fetch /api/poi-details
   ↓
Nominatim/Overpass/Wikidata/Wikipedia
   ↓
JSON → Drawer Update
```

**References:** `src/app/map/page.tsx:74`, `src/lib/data/pois/index.ts:120`, `src/components/map/MapView.tsx:192`, `src/components/map/PoiDetailsDrawer.tsx:120`, `src/app/api/poi-details/route.ts:514`

---

#### **Flow C: Country Panel → Weather + POIs + Chat**

```
User
   ↓
CountryPanel
   ├─ /api/weather → OpenWeather → Weather UI
   ├─ /api/pois → Datasets → POI UI
   └─ AtlasChat → /api/atlas-assistant → Ollama → Chat UI
```

**References:** `src/components/panels/CountryPanel.tsx:104`, `src/app/api/weather/route.ts:121`, `src/lib/services/weather/openweather.ts:242`, `src/app/api/pois/handler.ts:50`, `src/components/ai/AtlasChat.tsx:238`, `src/app/api/atlas-assistant/route.ts:66`

---

#### **Flow D: Stays → BBox Query → Cache → Rendering**

```
User
   ↓
MapView: Toggle Stays
   ↓
updateStaysViewport() → staysBbox
   ↓
fetch /api/stays?bbox=...
   ↓
getStaysProvider(mock|partner)
   ↓
Response cached (API + Client)
   ↓
Stays Layer/List rendered
```

**References:** `src/components/map/MapView.tsx:803`, `src/app/api/stays/route.ts:54`, `src/app/api/stays/route.ts:93`

---

#### **Flow E: Itinerary → Add/Remove → Optimize → Share**

```
User
   ↓
Toggle Stop (POI add/remove)
   ↓
Itinerary Store updates selectedStops
   ↓
createPlan() → optimizeGreedy + two-opt
   ↓
encodeItinerary() → /map?itinerary=...
   ↓
MapView: decodeItinerary() → loadFromShare
```

**References:** `src/components/map/PoiDetailsDrawer.tsx:57`, `src/lib/itinerary/store.tsx:46`, `src/lib/itinerary/optimize.ts:41`, `src/components/itinerary/ItineraryWidget.tsx:143`

---

### 13.3 File-by-File Walkthrough (Key Files)

#### `src/app/(marketing)/page.tsx`

| Property | Value |
|----------|-------|
| **Responsibility** | Server-side landing page entry; loads countries GeoJSON and renders `LandingClient` |
| **Key Exports** | `LandingPage` (default) |
| **Call Graph** | `/` → `LandingPage` → `loadCountries()` → `/data/countries.geojson` → `LandingClient` |
| **State Variables** | None (Server Component) |
| **Gotchas** | `loadCountries()` is server-only; builds base URL from env or request headers; incorrect values break GeoJSON fetch |

```typescript
export default async function LandingPage() {
   const countries = await loadCountries();
   return <LandingClient countries={countries} />;
}
```

---

#### `src/app/map/page.tsx`

| Property | Value |
|----------|-------|
| **Responsibility** | Server route for `/map`; calculates center/zoom from query params and loads POIs server-side |
| **Key Exports** | `getCenter`, `getZoom`, `MapPage` |
| **Call Graph** | `/map` → `MapPage` → `getCountryMeta` → `getPoisForMap` → `MapView` |
| **State Variables** | None (Server Component) |
| **Gotchas** | Default center from `NEXT_PUBLIC_DEFAULT_LAT/LON`; falls back to `{0,0}` on NaN; POI limit fixed at 200 |

```typescript
const center = getCenter(resolvedParams);
const zoom = getZoom(resolvedParams);
const pois = await getPoisForMap({
   lat: center.lat,
   lon: center.lon,
   limit: 200,
});
```

---

#### `src/components/globe/GlobeGL.tsx`

| Property | Value |
|----------|-------|
| **Responsibility** | 3D globe rendering and country selection/highlighting |
| **Key Exports** | `GlobeGL`, `GlobeHandle` methods (`flyToLatLon`, `highlightCountry`, `resetView`) |
| **State Variables** | `hoveredName`, `cursor`, `selectedCodeRef`, `hoveredCodeRef`, `pulseCodeRef` |
| **Gotchas** | WebGL is client-only; SSR disabled. Selection only works if `getResolvedCountryCode` returns a code |

```typescript
g.onPolygonClick((poly: object | null) => {
   const feature = poly as CountryFeature | null;
   const code = feature ? getResolvedCountryCode(feature) : null;
   if (!code) return;
   selectedCodeRef.current = code;
   updatePolygonColors();
   callbacksRef.current.onSelectCountry?.(code);
});
```

---

#### `src/components/map/MapView.tsx`

| Property | Value |
|----------|-------|
| **Responsibility** | Client map with MapLibre; POI filters, Stays layer, Itinerary, Details drawer |
| **Key Functions** | `updateStaysViewport()`, `selectPoi()`, `getMapCenter()` |
| **Key State** | `activeCategory`, `selectedPoiId`, `showStays`, `stays`, `staysBbox` |
| **Gotchas** | Stays fetch debounced & cached in `staysCacheRef`; wrong `NEXT_PUBLIC_MAP_STYLE_URL` falls back to demo style; `staysBbox` updated only on map events |

```typescript
const response = await fetch(`/api/stays?${params.toString()}`);
const data = (await response.json()) as StaysResponse;
setStays(data.stays ?? []);
setStaysMeta(data.meta ?? null);
```

---

#### `src/components/panels/CountryPanel.tsx`

| Property | Value |
|----------|-------|
| **Responsibility** | Weather, POIs, flights, and chat panel; manages geocoding and origin selection |
| **Key Functions** | `useCountryWeather`, `useCountryPlaces`, `handleGeocodeSearch`, `handleOpenFlights` |
| **Key State** | `origin`, `originStatus`, `geocodeQuery`, `geocodeResults`, `departDate`, `returnDate` |
| **Gotchas** | Weather/POI calls round coords and reject `0,0`; geocode starts only after 2 chars; fallback UI if country or focus missing |

```typescript
fetch(url, { signal: controller.signal })
   .then(async (res) => {
      let payload = null;
      try {
         payload = await res.json();
      } catch {
         payload = null;
      }
```

---

#### `src/components/ai/AtlasChat.tsx`

| Property | Value |
|----------|-------|
| **Responsibility** | Chat UI with LocalStorage persistence and API bridge |
| **Key Functions** | `buildStorageKey`, `loadStoredMessages`, `fetchAtlasAssistantResponse`, `executeIntents` |
| **Key State** | `messages`, `input`, `isLoading`, plus `agentMode`, `pendingIntents` from store |
| **Gotchas** | LocalStorage browser-only; `abortRef` cancels requests; fallback answer on invalid responses |

```typescript
const response = await fetch("/api/atlas-assistant", {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({
      messages: outgoingMessages,
      agentMode,
      uiState: uiStatePayload,
   }),
   signal: controller.signal,
});
```

---

#### `src/components/itinerary/ItineraryWidget.tsx`

| Property | Value |
|----------|-------|
| **Responsibility** | Trip planning UI: add/remove stops, optimize, share, and generate directions |
| **Key Functions** | `handleCreatePlan`, `handleCopyLink`, `handleOriginSearch`, `handleOpenDirections` |
| **Key State** | `copyState`, `originSheetOpen`, `originQuery`, `originResults`, `scenarioLabel` |
| **Gotchas** | Sharing uses `window.location.origin` and Clipboard API; `createPlan` does nothing with < 2 stops |

```typescript
const encoded = encodeItinerary(itinerary);
const url = `${window.location.origin}/map?itinerary=${encoded}`;
const ok = await copyToClipboard(url);
```

---

#### `src/app/api/poi-details/route.ts`

| Property | Value |
|----------|-------|
| **Responsibility** | POI enrichment API (address, OSM, images) from external sources |
| **Key Functions** | `fetchNominatim`, `fetchOverpass`, `fetchWikidataImage`, `fetchWikipediaImage` |
| **Key State** | `devCache`, `wikidataImageCache`, `wikipediaImageCache`, `nominatimQueue` |
| **Gotchas** | Validates `lat/lon` strictly; 400 on error; dev cache only in non-prod; Nominatim rate-limited |

```typescript
const { searchParams } = new URL(request.url);
const lat = parseNumber(searchParams.get("lat"));
const lon = parseNumber(searchParams.get("lon"));

if (!isValidLatLon(lat, lon)) {
   return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
}
```

---

#### `src/app/api/atlas-assistant/route.ts`

| Property | Value |
|----------|-------|
| **Responsibility** | POST API that forwards chat messages to Ollama and validates JSON response |
| **Key Exports** | `POST`, `resolveAgentMode`, `extractContent`, `buildFallback` |
| **Config** | `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `cache = 'no-store'` |
| **Gotchas** | Missing messages = 400; Ollama down = 503; no response caching |

```typescript
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434")
   .replace(/\/+$/, "");
const model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
const upstreamUrl = `${ollamaBaseUrl}/api/chat`;
```

---

#### `src/lib/data/pois/index.ts`

| Property | Value |
|----------|-------|
| **Responsibility** | Load, validate, and filter POI data by city/country/proximity |
| **Key Exports** | `getPoisForMap`, `getStaticPoisForCenter`, `getPois`, `applyFilters` |
| **Key Patterns** | Loads from `cityDatasets`/`countryDatasets`; validates via `parsePoisDataset`; falls back to `global.sample.json` |
| **Gotchas** | `ensureLimit` defaults to 12; invalid limit throws error; missing selectors throw `ServiceError` |

```typescript
export const getPoisForMap = async (params: GetPoisParams): Promise<POI[]> => {
   const limit = ensureLimit(params.limit);
   const center =
      Number.isFinite(params.lat) && Number.isFinite(params.lon)
         ? { lat: params.lat as number, lon: params.lon as number }
         : null;
```

---

#### `src/lib/services/weather/openweather.ts`

| Property | Value |
|----------|-------|
| **Responsibility** | OpenWeather provider; builds requests for current weather & forecast with TLS/timeout handling |
| **Key Exports** | `OpenWeatherService.getWeather`, `resolveTimeoutMs`, `resolveTlsState`, `requestWithTimeout` |
| **TLS Config** | Reads `ALLOW_INSECURE_TLS_FOR_DEV`, `NODE_EXTRA_CA_CERTS` |
| **Gotchas** | `OPENWEATHER_API_KEY` required; timeout & TLS affect fetch behavior; custom CA via env |

```typescript
async getWeather(
   lat: number,
   lon: number,
   options: WeatherOptions = {}
): Promise<WeatherData> {
   const apiKey = requireEnv("OPENWEATHER_API_KEY");
   const units = options.units ?? "metric";
   const lang = options.lang ?? "de";
```

---

### 13.4 Where to Change What (Maintenance Map)

| Goal | Files to Modify | Notes |
|------|-----------------|-------|
| **Modify globe behavior** | `src/components/globe/GlobeGL.tsx`, `src/components/landing/LandingClient.tsx` | Change `onPolygonClick`, hover logic, focus behavior |
| **Update POI filtering** | `src/lib/data/pois/index.ts`, `src/components/map/MapView.tsx` | Edit `applyFilters`, `filteredPois` calculations |
| **Add POI category** | `src/lib/data/pois/constants.ts`, `src/components/map/PoiCategoryIcon.tsx`, `src/components/map/MapView.tsx` | Extend `PLACE_CATEGORIES`, add icon, update filter UI |
| **Switch weather provider** | `src/lib/services/weather/index.ts`, `src/lib/services/weather/openweather.ts`, `src/app/api/weather/route.ts` | Create new provider, update `getWeatherService` |
| **Switch geocoding provider** | `src/lib/services/geocoding/index.ts`, `src/lib/services/geocoding/photon.ts`, `src/app/api/geocode/route.ts` | Create new provider, export from index |
| **Adjust caching policy** | `src/app/api/weather/route.ts` (600s), `src/app/api/geocode/route.ts` (7d), `src/app/api/stays/route.ts` (60s), `src/app/api/poi-details/route.ts` (1d + 7d SWR) | Update `revalidate` and `Cache-Control` headers |
| **Configure stays provider** | `src/app/api/stays/route.ts`, `src/lib/stays/providers/index.ts`, `src/lib/stays/providers/partner.ts` | Set `STAYS_PROVIDER=mock|partner`, configure endpoint/key |
| **Customize Atlas Assistant** | `src/lib/ai/atlasAssistant.prompt.ts`, `src/lib/ai/atlasAssistant.schema.ts`, `src/app/api/atlas-assistant/route.ts` | Edit prompt, JSON schema, route logic |

---

### 13.5 Verification Checklist

```bash
npm run dev
npm run lint
npm run test
npm run test:e2e
```

- [ ] **Landing**: Globe hover/click updates `CountryPanel` focus
- [ ] **Landing**: "Open Map" link navigates to `/map`
- [ ] **Map**: POIs visible; category filter updates markers and list
- [ ] **Map**: POI click opens drawer; details lazy-loaded via `/api/poi-details`
- [ ] **CountryPanel**: Weather loads (or shows clear error if API key missing)
- [ ] **CountryPanel**: POIs load for country/city
- [ ] **Map**: Stays toggle loads and displays meta status/fallback
- [ ] **AtlasChat**: Message → response via `/api/atlas-assistant`
- [ ] **Itinerary**: Add/remove stops, create plan, copy share link, reload with `?itinerary=...`

---

**Happy coding!**

