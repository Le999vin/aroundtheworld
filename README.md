 HEAD
# Global Travel Atlas

Immersive travel planning with a 3D globe, live weather, and curated places.

## Features
- 3D globe landing with hover + click focus
- Country detail panel with weather and POIs
- MapLibre view with filters and markers
- Provider-based API routes for weather, places, and geocoding
- Vitest baseline tests

## Tech Stack
- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- React Three Fiber + drei
- MapLibre GL

## Setup
```bash
npm install
npm run dev
```

## Environment Variables
```bash
# Providers
WEATHER_PROVIDER=openweather
PLACES_PROVIDER=opentripmap
GEOCODING_PROVIDER=photon

# Keys
OPENWEATHER_API_KEY=your_key
OPENTRIPMAP_API_KEY=your_key

# Defaults
NEXT_PUBLIC_DEFAULT_UNITS=metric
NEXT_PUBLIC_DEFAULT_LANG=de
NEXT_PUBLIC_DEFAULT_LAT=47.3769
NEXT_PUBLIC_DEFAULT_LON=8.5417

NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
NEXT_PUBLIC_MAP_TILES_ATTRIBUTION=Map data
```

## API Routes
- `GET /api/weather?lat=...&lon=...`
- `GET /api/places?lat=...&lon=...&radius=...&category=...`
- `GET /api/geocode?q=...`

## Scripts
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run test:watch`
- `npm run test:e2e`

## Wie fuege ich neue Staedte hinzu?
1. Erstelle eine neue JSON-Datei in `src/lib/data/pois/datasets/` (Array von POIs).
2. Fuege die Region in `src/lib/data/pois/regions.ts` mit passender Bounding Box hinzu.
3. Stelle sicher, dass jeder POI `source: "static"` setzt und die Felder aus `schema.ts` erfuellt.
4. Optional: Aktualisiere `global.sample.json` fuer einen besseren Fallback.

## Notes
- OpenWeather uses the One Call endpoint for current + daily forecast.
- POIs are loaded from local JSON datasets (no external API calls).
- Geocoding defaults to Photon.

# aroundtheworld
4247111e09476f29b718db16c0449670c72d4be5
