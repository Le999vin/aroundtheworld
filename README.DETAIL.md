# Global Travel Atlas (Detailed Engineering Guide)

This is the extended project guide for the aroundtheworld app. It explains the architecture, data flow, and the moving parts in detail so you can keep a clear overview while iterating.

## Quick start
1. Install deps: `npm install`
2. Create `.env.local` from `.env.local.example` and insert your keys.
3. Run dev: `npm run dev`

## High-level architecture
- **Next.js App Router** with a mix of Server Components (data loading) and Client Components (interactive UI).
- **3D Globe** rendered client-side with globe.gl (DOM + WebGL), fed by GeoJSON countries.
- **Map view** rendered client-side using MapLibre, with POI markers and filters.
- **Weather** fetched server-side via Route Handler -> OpenWeather.
- **POIs** are fully local, loaded from JSON datasets with region matching (no external Places API).

## Core user flows

### 1) Landing page (3D globe)
**Flow:**
- Server page loads countries GeoJSON from `public/data/countries.geojson` via `loadCountries()`.
- Client page (`LandingClient`) renders the globe and sets selected country state.
- Hover and click on countries update UI + panel.

**Key files:**
- `src/app/(marketing)/page.tsx` (Server Component)
- `src/components/landing/LandingClient.tsx` (Client Component)
- `src/components/globe/GlobeGL.tsx` (globe.gl)
- `public/data/countries.geojson`
- `src/lib/countries/loadCountries.ts`

**Snippet (server page):**
```tsx
import LandingClient from "@/components/landing/LandingClient";
import { loadCountries } from "@/lib/countries/loadCountries";

export default async function LandingPage() {
  const countries = await loadCountries();
  return <LandingClient countries={countries} />;
}
```

### 2) Country panel (weather + places)
**Flow:**
- `CountryPanel` is a Client Component that fetches:
  - `/api/weather?lat=...&lon=...`
  - `/api/static-places?lat=...&lon=...&limit=8`
- Weather is live from OpenWeather; POIs are local from JSON datasets.

**Key file:**
- `src/components/panels/CountryPanel.tsx`

**Snippet (places fetch):**
```ts
fetch(`/api/static-places?lat=${lat}&lon=${lon}&limit=8`)
```

### 3) Map view (local POIs)
**Flow:**
- `MapPage` is server-rendered and calls `getStaticPoisForCenter`.
- POIs are passed into `MapView` (client) for filtering + markers.

**Key files:**
- `src/app/map/page.tsx`
- `src/components/map/MapView.tsx`
- `src/lib/data/pois/index.ts`

**Snippet (server page):**
```tsx
const center = getCenter(searchParams ?? {});
const pois = await getStaticPoisForCenter(center);

return <MapView center={center} pois={pois} />;
```

## Data sources

### Countries GeoJSON
- File: `public/data/countries.geojson`
- Loaded server-side via `loadCountries()` with revalidate 86400 seconds.

**Snippet:**
```ts
const url = new URL("/data/countries.geojson", baseUrl);
const response = await fetch(url.toString(), {
  next: { revalidate: 86400 },
});
```

### Static POIs
POIs are local JSON datasets matched by bounding box.

**File structure:**
```
src/lib/data/pois/
  index.ts          // loader + distance sorting
  schema.ts         // types + runtime validation
  regions.ts        // bbox mapping + dataset import
  datasets/
    global.sample.json
    mumbai.json
    zurich.json
    paris.json
```

**Region matching:**
- If the requested center is inside a region bbox, use that dataset.
- Otherwise, fall back to `global.sample.json`.

**Snippet (region matching):**
```ts
const region = findRegionForCenter(center);
let pois = await loadRegionPois(region.id, region.dataset);
if (!pois.length && region.id !== fallbackRegion.id) {
  pois = await loadRegionPois(fallbackRegion.id, fallbackRegion.dataset);
}
```

## Services and API routes

### Weather API (OpenWeather)
- Route: `src/app/api/weather/route.ts`
- Service: `src/lib/services/weather/openweather.ts`
- Cache: `unstable_cache` with `revalidate: 600`

**Route snippet:**
```ts
const cached = unstable_cache(
  () => getWeather(lat, lon, { units, lang }),
  [`weather:openweather:${lat}:${lon}:${units}:${lang}`],
  { revalidate: 600 }
);
```

### Static POIs API
- Route: `src/app/api/static-places/route.ts`
- Returns data from `getStaticPoisForCenter` only.

**Snippet:**
```ts
const pois = await getStaticPoisForCenter({ lat, lon }, { limit: 12 });
return NextResponse.json(pois);
```

### Places API (legacy compatibility)
- Route: `src/app/api/places/route.ts`
- Currently also returns static POIs (no external calls).
- You can remove it later if not needed.

### Geocoding API
- Route: `src/app/api/geocode/route.ts`
- Service: `src/lib/services/geocoding/photon.ts`

## Globe implementation
- Component: `src/components/globe/GlobeGL.tsx`
- Library: globe.gl
- Data: GeoJSON polygons from `countries.features`
- Hover/click highlight with ISO A2 code lookup.
- Tooltip rendered as an absolute overlay in the globe container.

**Snippet (hover):**
```ts
g.onPolygonHover((poly) => {
  const code = getCountryCode(poly);
  const name = poly ? getCountryName(poly) : null;
  hoveredCodeRef.current = code ?? null;
  setHoveredName(name ?? null);
  onHoverCountry?.(code ?? null);
  updatePolygonColors();
});
```

## Environment variables
See `.env.local.example`. Typical values:
```
# Providers
WEATHER_PROVIDER=openweather
PLACES_PROVIDER=opentripmap

# Keys
OPENWEATHER_API_KEY=
OPENTRIPMAP_API_KEY=

# Defaults
NEXT_PUBLIC_DEFAULT_UNITS=metric
NEXT_PUBLIC_DEFAULT_LANG=de
NEXT_PUBLIC_DEFAULT_LAT=47.3769
NEXT_PUBLIC_DEFAULT_LON=8.5417

NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
```

Notes:
- POIs are now local, so OpenTripMap keys are not required unless you re-enable external Places.
- Do not commit `.env.local`.

## Add a new city dataset
1. Create a JSON file in `src/lib/data/pois/datasets/` with an array of `StaticPOI`.
2. Add a region entry in `src/lib/data/pois/regions.ts` with a bounding box and a lazy dataset import.
3. Ensure each POI includes `source: "static"` and valid `lat/lon`.

Example entry in `regions.ts`:
```ts
{
  id: "lisbon",
  label: "Lisbon",
  bbox: { minLat: 38.68, minLon: -9.25, maxLat: 38.82, maxLon: -9.08 },
  dataset: async () => (await import("./datasets/lisbon.json")).default,
}
```

## File map (by area)

**App routes**
- `src/app/(marketing)/page.tsx` - globe landing (server)
- `src/app/map/page.tsx` - map view (server)
- `src/app/country/[code]/page.tsx` - country detail page
- `src/app/api/weather/route.ts` - weather API
- `src/app/api/static-places/route.ts` - local POIs API
- `src/app/api/places/route.ts` - compatibility POIs API
- `src/app/api/geocode/route.ts` - geocode API

**Globe + UI**
- `src/components/globe/GlobeGL.tsx` - globe.gl
- `src/components/globe/GlobeScene.tsx` - legacy R3F globe (fallback)
- `src/components/landing/LandingClient.tsx` - UI layout + selection
- `src/components/panels/CountryPanel.tsx` - panel for weather + POIs
- `src/components/search/GlobalSearch.tsx` - search
- `src/components/map/MapView.tsx` - MapLibre view

**Data + services**
- `src/lib/countries/loadCountries.ts`
- `public/data/countries.geojson`
- `src/lib/data/pois/*` - static POI datasets
- `src/lib/services/weather/*` - OpenWeather adapter
- `src/lib/services/geocoding/*` - Photon adapter

## Testing
- Unit tests with Vitest: `npm run test`
- E2E with Playwright: `npm run test:e2e`

## Common extensions
- Add new globe layers (arcs, points) inside `GlobeGL`.
- Move globe textures from unpkg to `/public/textures` for offline stability.
- Expand `countryMeta.ts` with more country details.

