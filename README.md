# AroundTheWorld – Developer Documentation

## Übersicht

**AroundTheWorld** (Global Travel Atlas) ist eine Next.js-Anwendung, die Benutzer*innen ermöglicht, Länder auf einem 3D-Globus zu erkunden, kuratierte Sehenswürdigkeiten (POIs) anzuschauen und eine interaktive Karte mit Reiseplanung und Live-Wettervorhersagen zu nutzen.

---

## 1. Schnelleinstieg

### Voraussetzungen
- **Node.js** 18+ und npm

### Installation
```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Entwicklungsserver starten (mit POI-Registry-Generierung)
npm run build        # Produktions-Build
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

Erstelle eine `.env.local`-Datei mit folgenden Einträgen:

| Variable | Erforderlich | Beispiel | Zweck |
|----------|:---:|----------|---------|
| `OPENWEATHER_API_KEY` | ✅ | `sk_...` | OpenWeather API-Zugriff |
| `WEATHER_PROVIDER` | ❌ | `openweather` | Wetter-Service Auswahl |
| `GEOCODING_PROVIDER` | ❌ | `photon` | Geocoding-Service Auswahl |
| `PLACES_PROVIDER` | ❌ | `opentripmap` | Orte-Service Auswahl |
| `NEXT_PUBLIC_DEFAULT_LAT` | ❌ | `47.3769` | Standard-Kartenbreite |
| `NEXT_PUBLIC_DEFAULT_LON` | ❌ | `8.5417` | Standard-Kartenlänge |
| `NEXT_PUBLIC_DEFAULT_UNITS` | ❌ | `metric` | Wetter-Einheiten |
| `NEXT_PUBLIC_DEFAULT_LANG` | ❌ | `de` | Wetter-Sprache |
| `NEXT_PUBLIC_MAP_STYLE_URL` | ❌ | MapLibre Style JSON | Kartenstil |
| `AI_PROVIDER` | ❌ | `ollama` | KI-Provider |
| `OLLAMA_BASE_URL` | ❌ | `http://127.0.0.1:11434` | Ollama-Server |
| `OLLAMA_MODEL` | ❌ | `llama3.1:8b` | Ollama-Modell |

---

## 2. Projekt-Struktur

### 📁 Hauptverzeichnisse

```
aroundtheworld/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (marketing)/        # Landing Page
│   │   ├── map/                # Karten-Seite
│   │   ├── country/[code]/     # Land-Details
│   │   └── api/                # API-Routen
│   ├── components/             # React UI-Komponenten
│   ├── lib/                    # Geschäftslogik & Services
│   └── styles/                 # Globale Styles
├── public/
│   ├── data/                   # GeoJSON & Statische Daten
│   └── textures/               # Globe-Texturen
├── scripts/                    # Build & Daten-Scripts
├── docs/                       # Dokumentation
└── package.json
```

### 🔑 Wichtige Dateien

| Pfad | Zweck |
|------|--------|
| `src/app/(marketing)/page.tsx` | Landing Page mit 3D-Globus |
| `src/app/map/page.tsx` | Interaktive Kartenseite |
| `src/app/country/[code]/page.tsx` | Länder-Details Panel |
| `src/components/landing/LandingClient.tsx` | Globus-UI Controller |
| `src/components/map/MapView.tsx` | Kartenfunktionalität |
| `src/components/panels/CountryPanel.tsx` | Länder-Informations-Panel |
| `src/lib/data/pois/index.ts` | POI-Datenverwaltung |
| `src/lib/services/weather/openweather.ts` | Wetter-Integration |

---

## 3. Architektur-Übersicht

### Datenfluss

```
┌─────────────────────────────────────────────────┐
│          Benutzer-Interface (React)             │
├─────────────────────────────────────────────────┤
│  3D-Globus │ Karte │ Land-Panel │ KI-Chat      │
└──────────────────┬──────────────────────────────┘
           │
     ┌───────────┴───────────┐
     ↓                       ↓
   ┌─────────┐          ┌──────────────┐
   │ API     │          │ Datenquellen │
   │ Routes  │          ├──────────────┤
   ├─────────┤          │ GeoJSON      │
   │ /weather│          │ POI-Datasets │
   │ /pois   │          │ Metadaten    │
   │ /geocode│          └──────────────┘
   │ /ai     │
   │ /details│
   └────┬────┘
    │
    ↓
   ┌──────────────────┐
   │ Externe Services │
   ├──────────────────┤
   │ OpenWeather      │
   │ OpenTripMap      │
   │ Photon (Geocode) │
   │ Ollama (KI)      │
   └──────────────────┘
```

### Hauptkomponenten

| Komponente | Funktion |
|-----------|----------|
| **GlobeGL** | 3D-Globus Rendering & Länder-Auswahl |
| **MapView** | Interaktive Karte mit POI-Filtern |
| **CountryPanel** | Wetter, Sehenswürdigkeiten, Flüge, KI-Chat |
| **PoiDetailsDrawer** | Detaillierte POI-Informationen |
| **ItineraryWidget** | Reiseplanung & Routenoptimierung |
| **AtlasChat** | KI-Assistent mit Streaming-Antworten |

---

## 4. API-Routen

### `/api/weather`
**Funktionalität:** Aktuelle Wetter- und Vorhersagedaten  
**Parameter:** `lat`, `lon`  
**Antwort:** `{ current: {...}, daily: [...] }`  
**Caching:** 10 Minuten

### `/api/pois`
**Funktionalität:** Kuratierte Sehenswürdigkeiten  
**Parameter:** `lat`, `lon`, `country`, `limit`, `category`  
**Antwort:** `{ pois: [{ id, name, category, lat, lon, ... }] }`  
**Datenquelle:** Lokale Datensätze

### `/api/geocode`
**Funktionalität:** Adresse ↔ Koordinaten  
**Parameter:** `address` oder `lat`, `lon`  
**Antwort:** `{ lat, lon, address, city }`  
**Provider:** Photon  
**Caching:** 7 Tage

### `/api/poi-details`
**Funktionalität:** Erweiterte POI-Informationen  
**Parameter:** `id`, `lat`, `lon`  
**Antwort:** `{ address, images, wikipedia, osmTags, ... }`  
**Quellen:** Nominatim, Overpass, Wikidata, Wikipedia

### `/api/ai`
**Funktionalität:** KI-Assistent mit Streaming  
**Parameter:** `message`, `context`  
**Antwort:** Server-Sent Events (SSE)  
**Provider:** Ollama (lokal)  
**Format:** JSON-Action-Envelopes

---

## 5. Datenmodell

### POI-Schema

```typescript
{
  id: string                    // Eindeutige ID
  name: string                  // Sehenswürdigkeits-Name
  category: string              // Kategorie (museum, restaurant, etc.)
  lat: number                   // Breitengrad
  lon: number                   // Längengrad
  city: string                  // Stadt
  country: string               // Land-Code (ISO-2)
  source: string                // Datenquelle
  address?: string              // Optional: Adresse
  images?: string[]             // Optional: Bilder
  osm?: object                  // Optional: OSM-Metadaten
}
```

### Kategorien

- `museum` – Museen & Kunstgalerien
- `monument` – Denkmal & historische Stätten
- `restaurant` – Restaurants & Cafés
- `hotel` – Übernachtungen
- `attraction` – Sehenswürdigkeiten
- `nature` – Parks & Naturgebiete

---

## 6. POI-Datensätze

### Lokale Datensätze

POI-Datensätze sind organisiert nach:

**Nach Stadt:** `src/lib/data/pois/datasets/cities/*.json`  
Beispiele: `amsterdam.json`, `paris.json`, `tokyo.json`

**Nach Land:** `src/lib/data/pois/datasets/countries/*.json`  
Beispiele: `DE.json` (Deutschland), `FR.json` (Frankreich)

### Datensatz-Registry

Die Datei `src/lib/data/pois/registry.generated.ts` wird automatisch generiert durch:
```bash
npm run predev    # vor npm run dev
```

Sie enthält:
- City-Loaders mit Bounding-Boxes
- Land-Datensatz-Zuordnungen
- Koordinaten-Zentren für Zoom-Funktionen

---

## 7. Erweiterungsleitfaden

### ➕ Neues Land hinzufügen

1. **Datensatz erstellen:**
   ```bash
   touch src/lib/data/pois/datasets/countries/XX.json
   ```

2. **Format-Vorlage:**
   ```json
   [
   {
     "id": "poi-1",
     "name": "Sehenswürdigkeit",
     "category": "museum",
     "lat": 51.5074,
     "lon": -0.1278,
     "city": "Hauptstadt",
     "country": "XX",
     "source": "manual"
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

### ➕ Neue POI-Kategorie hinzufügen

1. **In `src/lib/data/pois/constants.ts`:**
   ```typescript
   export const PLACE_CATEGORIES = [
   'museum',
   'restaurant',
   'my_new_category',  // ← hinzufügen
   // ...
   ] as const;
   ```

2. **In `src/components/map/PoiCategoryIcon.tsx`:**
   ```typescript
   case 'my_new_category':
   return <MyNewCategoryIcon />;
   ```

3. **Filter aktualisieren in `MapView.tsx`**

### ➕ Neue API-Route erstellen

1. **Datei erstellen:** `src/app/api/myfeature/route.ts`

2. **Template:**
   ```typescript
   import { ServiceError } from '@/lib/services/errors';

   export async function GET(request: Request) {
   try {
     // Logik hier
     return Response.json({ data: result });
   } catch (error) {
     return ServiceError.handleError(error);
   }
   }
   ```

3. **In Component aufrufen:**
   ```typescript
   const response = await fetch('/api/myfeature?param=value');
   const data = await response.json();
   ```

---

## 8. Performance & Optimierung

### Caching-Strategien

| Route | Methode | Dauer | Grund |
|-------|---------|-------|-------|
| `/api/weather` | `unstable_cache` | 10 Minuten | Häufige Anfragen |
| `/api/geocode` | `unstable_cache` | 7 Tage | Selten ändernd |
| `/api/poi-details` | In-Memory | Session | Teure Lookups |

### Performance-Tipps

✅ **Gut für Renderer:**
- `GlobeGL` und `MapView` mit stabilen Props
- Memoization für teure Components
- Lazy Loading für große Datensätze

⚠️ **Zu vermeiden:**
- Inline-Funktionen in Props
- Unnötige Re-Renders
- Große POI-Listen ohne Pagination (>500)

---

## 9. Fehlerbehebung

### Problem: `npm run dev` schlägt fehl

**Ursache:** TypeScript-Script-Ausführung  
**Lösung:**
```bash
# Option 1: npx tsx verwenden
npx tsx scripts/generate-poi-registry.ts

# Option 2: Scripts zu JavaScript konvertieren
```

### Problem: Wetter wird nicht angezeigt

**Checkliste:**
- [ ] `OPENWEATHER_API_KEY` gesetzt?
- [ ] API-Key gültig?
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
- Fallback auf Demo-Tiles aktivieren?

---

## 10. Tech-Stack

| Bereich | Technologie | Version |
|---------|------------|---------|
| **Framework** | Next.js | 16 |
| **Rendering** | React | 19 |
| **Sprache** | TypeScript | Latest |
| **Styling** | Tailwind CSS | 4 |
| **UI-Komponenten** | shadcn/ui (Radix) | Latest |
| **3D-Globus** | globe.gl + three.js | Latest |
| **Kartierung** | MapLibre GL | Latest |
| **Testing** | Vitest + Playwright | Latest |

---

## 11. Contributor-Richtlinien

### Ordnerstruktur einhalten

```
✅ RICHTIG:
src/components/        → UI-Komponenten
src/lib/              → Business-Logik
src/app/              → Routen & Pages
scripts/              → Build-Automatisierung

❌ FALSCH:
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

| ✅ Do | ❌ Don't |
|------|---------|
| POI-Registry nach Datensatz-Änderungen regenerieren | `.env.local` ins Repo committen |
| `ServiceError` für API-Fehler nutzen | API-Keys in Code hard-coden |
| Props stabil halten für Performance | Inline-Funktionen in Props |
| Unit-Tests schreiben | Breaking Changes ohne Migration |
| TypeScript-Types nutzen | `any` verwenden |

---

## 12. Weitere Ressourcen

📚 **Dokumentation:**
- `README.md` – Quickstart auf Deutsch
- `docs/project-analysis.md` – Technische Audit
- `docs/poi-maps-enrichment.todo.md` – Enhancement Backlog

🔗 **Externe APIs:**
- [OpenWeather API](https://openweathermap.org/api)
- [Photon Geocoding](https://photon.komoot.io/)
- [OpenTripMap](https://opentripmap.com/api)
- [Nominatim (OSM)](https://nominatim.org/)

🛠️ **Development Tools:**
- `tsx` – TypeScript Node Runner
- `vitest` – Unit Testing
- `playwright` – E2E Testing
- `eslint` – Code Linting

---

**Viel Erfolg beim Entwickeln! 🚀**
