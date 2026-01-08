// Map page showing a zoomed-in view with POIs
import Link from "next/link";
import MapView from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import { getPoisForMap } from "@/lib/data/pois";
import { getCountryMeta, resolveCountryCenterFromMeta } from "@/lib/countries/countryMeta";

const defaultLat = Number(process.env.NEXT_PUBLIC_DEFAULT_LAT);
const defaultLon = Number(process.env.NEXT_PUBLIC_DEFAULT_LON);

const DEFAULT_CENTER =
  Number.isFinite(defaultLat) && Number.isFinite(defaultLon)
    ? { lat: defaultLat, lon: defaultLon }
    : { lat: 0, lon: 0 };

const DEFAULT_ZOOM = 5;
const CITY_ZOOM = 11;
const POI_ZOOM = 13;

const parseNumber = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getCenter = (searchParams: { lat?: string; lon?: string; country?: string }) => {
  const lat = parseNumber(searchParams.lat);
  const lon = parseNumber(searchParams.lon);
  if (lat !== undefined && lon !== undefined) {
    return { lat, lon };
  }
  if (searchParams.country) {
    const meta = getCountryMeta(searchParams.country);
    const center = resolveCountryCenterFromMeta(meta);
    if (center) return center;
  }
  return DEFAULT_CENTER;
};

const getZoom = (searchParams: {
  country?: string;
  city?: string;
  poi?: string;
}) => {
  if (searchParams.poi) return POI_ZOOM;
  if (searchParams.city) return CITY_ZOOM;
  if (searchParams.country) return DEFAULT_ZOOM;
  return DEFAULT_ZOOM;
};

export default async function MapPage({
  searchParams,
}: {
  searchParams?: Promise<{
    lat?: string;
    lon?: string;
    country?: string;
    city?: string;
    poi?: string;
  }>;
}) {
  type MapSearchParams = {
    lat?: string;
    lon?: string;
    country?: string;
    city?: string;
    poi?: string;
  };
  const resolvedParams = (await Promise.resolve(
    searchParams ?? {}
  )) as MapSearchParams;
  const center = getCenter(resolvedParams);
  const zoom = getZoom(resolvedParams);
  const pois = await getPoisForMap({
    lat: center.lat,
    lon: center.lon,
    country: resolvedParams.country,
    city: resolvedParams.city,
    limit: 200,
  });

  return (
    <div className="min-h-screen px-6 pb-10 pt-6 text-white">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
            Map Mode
          </p>
          <h1 className="font-display text-3xl text-white">Zoomed View</h1>
          <p className="mt-1 text-sm text-slate-300">
            Filter curated POIs and plan your route.
          </p>
        </div>
        <Link href="/">
          <Button variant="secondary">Back to Globe</Button>
        </Link>
      </header>

      <MapView
        center={center}
        initialZoom={zoom}
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        pois={pois}
      />
    </div>
  );
}
