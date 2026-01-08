import Link from "next/link";
import { notFound } from "next/navigation";
import CountryPanel from "@/components/panels/CountryPanel";
import { Button } from "@/components/ui/button";
import { getCountryMeta, resolveCountryCenterFromMeta } from "@/lib/countries/countryMeta";
import type { Focus } from "@/lib/types";

export default function CountryDetailPage({
  params,
}: {
  params: { code: string };
}) {
  const country = getCountryMeta(params.code);
  const center = resolveCountryCenterFromMeta(country);
  const focus: Focus | null = center
    ? {
        kind: "country",
        source: "map",
        code: country?.code,
        name: country?.name ?? params.code,
        lat: center.lat,
        lon: center.lon,
      }
    : null;

  if (!country) {
    notFound();
  }

  return (
    <div className="min-h-screen px-6 pb-10 pt-6 text-white">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
            Country Detail
          </p>
          <h1 className="font-display text-3xl text-white">{country.name}</h1>
          <p className="mt-1 text-sm text-slate-300">
            Dive deeper into weather, cities, and top sights.
          </p>
        </div>
        <Link href="/">
          <Button variant="secondary">Back to Globe</Button>
        </Link>
      </header>

      <div className="relative">
        <CountryPanel country={country} focus={focus} />
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
            Overview
          </p>
          <p className="mt-4 max-w-2xl text-base text-slate-100">
            This page anchors the selected country while keeping the live panels
            for weather and highlights. Add itineraries, favorites, or seasonal
            insights here in phase two.
          </p>
        </div>
      </div>
    </div>
  );
}
