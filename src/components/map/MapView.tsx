"use client";

import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { POI, PlaceCategory } from "@/lib/types";

const CATEGORIES: PlaceCategory[] = [
  "landmarks",
  "museums",
  "food",
  "nightlife",
  "nature",
];

type MapViewProps = {
  center: { lat: number; lon: number };
  pois: POI[];
};

export const MapView = ({ center, pois }: MapViewProps) => {
  const [activeCategory, setActiveCategory] = useState<
    PlaceCategory | "all"
  >("all");

  const filteredPois = useMemo(() => {
    if (activeCategory === "all") return pois;
    return pois.filter((poi) => poi.category === activeCategory);
  }, [pois, activeCategory]);

  const mapStyle =
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    "https://demotiles.maplibre.org/style.json";

  return (
    <div className="relative flex h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-lg md:flex-row">
      <aside className="w-full max-w-md border-b border-white/10 bg-slate-950/40 p-6 md:h-full md:border-b-0 md:border-r">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
              Explore Map
            </p>
            <h2 className="font-display text-2xl text-white">
              Points of Interest
            </h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveCategory("all")}
          >
            Reset
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", ...CATEGORIES] as const).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] transition ${
                activeCategory === category
                  ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 text-slate-300 hover:border-white/30"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3 overflow-y-auto pr-2 text-sm text-white md:max-h-[calc(100vh-16rem)]">
          {filteredPois.map((poi) => (
            <div
              key={poi.id}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{poi.name}</p>
                {poi.rating ? (
                  <Badge className="bg-white/10 text-white">
                    {poi.rating.toFixed(1)}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                {poi.category}
              </p>
              {poi.address ? (
                <p className="mt-2 text-xs text-slate-300">{poi.address}</p>
              ) : null}
            </div>
          ))}
          {!filteredPois.length ? (
            <p className="text-sm text-slate-400">No places in this filter.</p>
          ) : null}
        </div>
      </aside>

      <div className="relative h-[60vh] flex-1 md:h-full">
        <Map
          mapLib={maplibregl}
          mapStyle={mapStyle}
          initialViewState={{
            longitude: center.lon,
            latitude: center.lat,
            zoom: 5,
          }}
          attributionControl={false}
        >
          <NavigationControl position="top-right" />
          {filteredPois.map((poi) => (
            <Marker
              key={poi.id}
              longitude={poi.lon}
              latitude={poi.lat}
              anchor="bottom"
            >
              <div className="h-3 w-3 rounded-full border border-white/80 bg-cyan-300 shadow-lg" />
            </Marker>
          ))}
        </Map>
      </div>
    </div>
  );
};

export default MapView;
