// Map-Ansicht mit Marker + Filter + Liste
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { MapRef } from "react-map-gl/maplibre";
import Map, { Layer, Marker, NavigationControl, Source } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { ItineraryWidget } from "@/components/itinerary/ItineraryWidget";
import { PoiDetailsDrawer } from "@/components/map/PoiDetailsDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLACE_CATEGORIES } from "@/lib/data/pois/constants";
import { decodeItinerary } from "@/lib/itinerary/share";
import { ItineraryProvider, useItinerary } from "@/lib/itinerary/store";
import { createStopFromPoi } from "@/lib/itinerary/utils";
import type { POI, PlaceCategory } from "@/lib/types";

type MapViewProps = {
  center: { lat: number; lon: number };
  initialZoom: number;
  defaultCenter: { lat: number; lon: number };
  defaultZoom: number;
  pois: POI[];
};

const MapViewContent = ({
  center,
  initialZoom,
  defaultCenter,
  defaultZoom,
  pois,
}: MapViewProps) => {
  const [activeCategory, setActiveCategory] = useState<
    PlaceCategory | "all"
  >("all");
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [isPoiDrawerOpen, setIsPoiDrawerOpen] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const searchParams = useSearchParams();
  const shareParam = searchParams.get("itinerary");
  const shareLoadedRef = useRef(false);
  const {
    selectedStops,
    optimizedStops,
    isPlanFull,
    maxStops,
    hydrated,
    toggleStop,
    loadFromShare,
  } = useItinerary();

  const filteredPois = useMemo(() => {
    if (activeCategory === "all") return pois;
    return pois.filter((poi) => poi.category === activeCategory);
  }, [pois, activeCategory]);

  const selectedPoi = useMemo(() => {
    if (!selectedPoiId) return null;
    return pois.find((poi) => poi.id === selectedPoiId) ?? null;
  }, [pois, selectedPoiId]);

  const mapStyle =
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
    "https://demotiles.maplibre.org/style.json";

  const hasPois = pois.length > 0;
  const selectedStopIds = useMemo(
    () => new Set(selectedStops.map((stop) => stop.id)),
    [selectedStops]
  );
  const routeCoordinates = useMemo(
    () =>
      optimizedStops?.map((stop) => [stop.lon, stop.lat]) ?? [],
    [optimizedStops]
  );
  const routeGeoJson = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: routeCoordinates,
      },
    }),
    [routeCoordinates]
  );

  const selectPoi = useCallback((poiId: string) => {
    setSelectedPoiId(poiId);
    setIsPoiDrawerOpen(true);
  }, []);

  const closePoiDrawer = useCallback(() => {
    setIsPoiDrawerOpen(false);
    setSelectedPoiId(null);
  }, []);

  const handleCenterPoi = useCallback(
    (poi: POI) => {
      const currentZoom = mapRef.current?.getZoom();
      mapRef.current?.flyTo({
        center: [poi.lon, poi.lat],
        zoom: currentZoom ?? initialZoom,
        essential: true,
      });
    },
    [initialZoom]
  );

  const handleReset = () => {
    setActiveCategory("all");
    mapRef.current?.flyTo({
      center: [defaultCenter.lon, defaultCenter.lat],
      zoom: defaultZoom,
      essential: true,
    });
  };

  const getMapCenter = useCallback(() => {
    const center = mapRef.current?.getCenter();
    if (!center) return undefined;
    return { lat: center.lat, lon: center.lng };
  }, []);

  useEffect(() => {
    if (!selectedPoiId) return;
    const stillVisible = filteredPois.some((poi) => poi.id === selectedPoiId);
    if (!stillVisible) {
      setIsPoiDrawerOpen(false);
      setSelectedPoiId(null);
    }
  }, [filteredPois, selectedPoiId]);

  useEffect(() => {
    if (!hydrated || shareLoadedRef.current) return;
    if (!shareParam) return;
    const decoded = decodeItinerary(shareParam);
    if (decoded) {
      loadFromShare(decoded);
    }
    shareLoadedRef.current = true;
  }, [hydrated, loadFromShare, shareParam]);

  useEffect(() => {
    mapRef.current?.flyTo({
      center: [center.lon, center.lat],
      zoom: initialZoom,
      essential: true,
    });
  }, [center.lat, center.lon, initialZoom]);

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
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", ...PLACE_CATEGORIES] as const).map((category) => (
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
          {filteredPois.map((poi) => {
            const isSelected = poi.id === selectedPoiId;
            const isInPlan = selectedStopIds.has(poi.id);
            const isAddDisabled = !isInPlan && isPlanFull;
            return (
              <div
                key={poi.id}
                onClick={() => selectPoi(poi.id)}
                aria-pressed={isSelected}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectPoi(poi.id);
                  }
                }}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-cyan-300/60 bg-cyan-300/10"
                    : "border-white/10 bg-white/5 hover:border-white/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
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
                      <p className="mt-2 text-xs text-slate-300">
                        {poi.address}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isInPlan ? "secondary" : "outline"}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleStop(createStopFromPoi(poi));
                    }}
                    disabled={isAddDisabled}
                    title={
                      isAddDisabled
                        ? `Maximal ${maxStops} Orte im Plan.`
                        : undefined
                    }
                    className="shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10"
                  >
                    {isInPlan ? "Entfernen" : "+ Zu Plan"}
                  </Button>
                </div>
              </div>
            );
          })}
          {!hasPois ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
              <p>No curated POIs yet for this destination.</p>
            </div>
          ) : !filteredPois.length ? (
            <p className="text-sm text-slate-400">No places in this filter.</p>
          ) : null}
        </div>
      </aside>

      <div className="relative h-[60vh] flex-1 md:h-full">
        <Map
          mapLib={maplibregl}
          mapStyle={mapStyle}
          ref={mapRef}
          initialViewState={{
            longitude: center.lon,
            latitude: center.lat,
            zoom: initialZoom,
          }}
          attributionControl={false}
        >
          <NavigationControl position="top-right" />
          {routeCoordinates.length >= 2 ? (
            <Source id="itinerary-route" type="geojson" data={routeGeoJson}>
              <Layer
                id="itinerary-route-line"
                type="line"
                layout={{
                  "line-join": "round",
                  "line-cap": "round",
                }}
                paint={{
                  "line-color": "#22d3ee",
                  "line-width": 3,
                  "line-opacity": 0.85,
                }}
              />
            </Source>
          ) : null}
          {filteredPois.map((poi) => {
            const isSelected = poi.id === selectedPoiId;
            return (
              <Marker
                key={poi.id}
                longitude={poi.lon}
                latitude={poi.lat}
                anchor="bottom"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectPoi(poi.id);
                  }}
                  title={poi.name}
                  aria-label={`Show details for ${poi.name}`}
                  className="group flex h-6 w-6 items-center justify-center"
                >
                  <span
                    className={`h-3 w-3 rounded-full border border-white/80 shadow-lg transition ${
                      isSelected
                        ? "bg-cyan-200 ring-4 ring-cyan-200/40"
                        : "bg-cyan-300"
                    }`}
                  />
                </button>
              </Marker>
            );
          })}
        </Map>
        <ItineraryWidget getMapCenter={getMapCenter} />
      </div>

      <PoiDetailsDrawer
        poi={selectedPoi}
        open={isPoiDrawerOpen && Boolean(selectedPoi)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closePoiDrawer();
          }
        }}
        onCenter={handleCenterPoi}
      />
    </div>
  );
};

export const MapView = (props: MapViewProps) => (
  <ItineraryProvider>
    <MapViewContent {...props} />
  </ItineraryProvider>
);

export default MapView;
