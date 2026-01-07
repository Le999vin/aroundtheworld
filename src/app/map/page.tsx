import Link from "next/link";
import MapView from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import { countryMeta } from "@/lib/countries/countryMeta";
import { getStaticPoisForCenter } from "@/lib/data/pois";

const defaultLat = Number(process.env.NEXT_PUBLIC_DEFAULT_LAT);
const defaultLon = Number(process.env.NEXT_PUBLIC_DEFAULT_LON);

const defaultCenter = Number.isFinite(defaultLat) && Number.isFinite(defaultLon)
  ? { lat: defaultLat, lon: defaultLon }
  : { lat: countryMeta[0].lat, lon: countryMeta[0].lon };

const getCenter = (searchParams: { lat?: string; lon?: string }) => {
  const lat = Number(searchParams.lat);
  const lon = Number(searchParams.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }
  return defaultCenter;
};

export default async function MapPage({
  searchParams,
}: {
  searchParams?: { lat?: string; lon?: string };
}) {
  const center = getCenter(searchParams ?? {});
  const pois = await getStaticPoisForCenter(center);

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

      <MapView center={center} pois={pois} />
    </div>
  );
}
