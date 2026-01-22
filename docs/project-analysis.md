# Global Travel Atlas - Projektanalyse

## Umfang
- Geprueft: App Routing, API Routes, Services, Data Loader, UI Komponenten, Skripte, Tests und Doku.
- Fokus: Bugs, Stabilitaet, Datenqualitaet sowie fehlendes oder inkonsistentes Tooling.

## Kernbefunde (Issues und Risiken)

### Hoher Impact
1) Node Skripte fuehren TypeScript via `node` aus (bricht auf Standard-Node).
   - Evidenz: `scripts/generate-poi-registry.ts`, `scripts/fix-poi-datasets.ts`, `scripts/validate-poi-datasets.ts`, `scripts/poi-schema.ts`.
   - Impact: `npm run dev` nutzt `predev` und kann scheitern; POI Fix/Validate laeuft nicht; Registry kann veralten.
   - Fix: Skripte auf `.js` umstellen (TS Syntax entfernen) oder mit `tsx`/`ts-node` ausfuehren und `package.json` anpassen.

2) Externe Provider Calls ohne Timeout.
   - Evidenz: `src/app/api/poi-details/route.ts` (Nominatim, Overpass), `src/lib/services/geocoding/photon.ts`, `src/lib/services/places/opentripmap.ts`.
   - Impact: Haenger, Serverless Timeouts, langsame UI, 502 Peaks.
   - Fix: `AbortController` mit festen Timeouts verwenden; Timeout auf `ServiceError` mappen.

3) Daten-Encoding korrupt (mojibake) in POI Datasets und Doku.
   - Evidenz: `src/lib/data/pois/datasets/cities/istanbul.json`, `src/components/globe/GlobeGL.tsx`, `README_Global_Travel_Atlas.md`.
   - Impact: kaputte Namen/Adressen, schlechtes Matching, falsche Labels, Geocoding Drift.
   - Fix: Dateien auf UTF-8 (ohne BOM) normalisieren, Daten aus sauberer Quelle re-importieren, Encoding Checks in CI.

### Mittlerer Impact
4) Globe GeoJSON ohne Preprocessing (Winding/Dateline).
   - Evidenz: `src/components/globe/GlobeGL.tsx`, `public/data/countries.geojson`.
   - Impact: inverted fill bei Inseln (z.B. Bermuda) und Flicker/Z-Fighting an Caps.
   - Fix: GeoJSON preprocess (rewind + antimeridian split) und Polygon-Altitude leicht erhoehen.

5) Temperatur-Symbol in der UI ist kaputt.
   - Evidenz: `src/components/panels/CountryPanel.tsx`.
   - Impact: Weather UI zeigt ein defektes "C".
   - Fix: sauberes ASCII Fallback (z.B. "deg C") oder Gradzeichen, wenn UTF-8 garantiert ist.

6) Default Nominatim User-Agent ist ein Platzhalter.
   - Evidenz: `src/app/api/poi-details/route.ts`.
   - Impact: Requests koennen gedrosselt oder geblockt werden.
   - Fix: echten `NOMINATIM_USER_AGENT` als Pflicht-Env setzen und dokumentieren.

### Niedriger Impact / Tech Debt
7) Doppelte README Dateien mit divergierender Env-Doku.
   - Evidenz: `README.md`, `README_Global_Travel_Atlas.md`, `.env.local.example`.
   - Impact: Verwirrung ueber required Keys (z.B. OpenTripMap).
   - Fix: auf eine README konsolidieren und `.env.local.example` synchron halten.

8) Unbegrenzte In-Memory Caches.
   - Evidenz: `src/app/api/weather/route.ts`, `src/app/api/poi-details/route.ts`.
   - Impact: Memory-Wachstum bei langen Uptime.
   - Fix: TTL Eviction oder LRU Cache mit Max Size.

9) Playwright Script existiert ohne Config/Tests.
   - Evidenz: `package.json`, fehlendes `playwright.config.*`.
   - Impact: `npm run test:e2e` laeuft ins Leere oder faellt.
   - Fix: Config + Minimal Spec hinzufuegen oder Script entfernen.

## Datenqualitaet
- `docs/poi-maps-enrichment.todo.md` listet viele POIs ohne Address und ohne googlePlaceId in `src/lib/data/pois/datasets/global.sample.json`.
- Mehrere City Datasets zeigen Encoding-Probleme und sollten re-importiert oder normalisiert werden.

## Testabdeckung / Gaps
- Aktuelle Tests covern Services und Basis-POI Auswahl, aber nicht:
  - `/api/poi-details` Happy/Error Paths.
  - GeoJSON Preprocessing (Winding/Dateline).
  - Client UX Flows (Hover, Globe Click, Map Filter).

## Fix-Vorschlaege (Shortlist)
1) Script Execution normalisieren (JS oder `tsx` + Script Update).
2) Timeouts für alle externen Fetch Calls (Nominatim, Overpass, Photon, OpenTripMap).
3) Dataset Encoding normalisieren und in CI validieren.
4) GeoJSON Preprocessing für stabile Globe-Fuellung.
5) Doku und Env Beispiele konsistent halten.

## Erweiterungsideen
- Dynamic POIs: OpenTripMap optional in `/api/pois` integrieren, wenn statische Daten fehlen.
- Itinerary Export: GPX/KML Export und Share-Links.
- Offline Mode: Country Meta + POI Datasets mit Service Worker cachen.
- Admin Tools: kleine POI Editor UI für Kuratierung/Validierung.
- Observability: strukturierte Logs und Rate-Limit Metriken für Provider Calls.
- Data Pipeline: Nightly Job für Enrichment und Re-Validation.
