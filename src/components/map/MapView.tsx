// Map-Ansicht mit Marker + Filter + Liste
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  MapLayerMouseEvent,
  MapRef,
  ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import type { FilterSpecification } from "maplibre-gl";
import { ItineraryWidget } from "@/components/itinerary/ItineraryWidget";
import { PoiCategoryIcon } from "@/components/map/PoiCategoryIcon";
import { PoiDetailsDrawer } from "@/components/map/PoiDetailsDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLACE_CATEGORIES } from "@/lib/data/pois/constants";
import { decodeItinerary } from "@/lib/itinerary/share";
import { ItineraryProvider, useItinerary } from "@/lib/itinerary/store";
import { createStopFromPoi } from "@/lib/itinerary/utils";
import {
  buildFeaturedCitiesGeoJson,
  type FeaturedCityProps,
} from "@/lib/map/featuredCities";
import { haversineKm } from "@/lib/map/distance";
import type { POI, PlaceCategory } from "@/lib/types";

type MapViewProps = {
  center: { lat: number; lon: number };
  initialZoom: number;
  defaultCenter: { lat: number; lon: number };
  defaultZoom: number;
  pois: POI[];
};

type SelectedCity = FeaturedCityProps & {
  lat: number;
  lon: number;
};

type SearchResult =
  | { type: "city"; city: SelectedCity }
  | { type: "poi"; poi: POI };

type NearbyPoiEntry = {
  poi: POI;
  distanceKm: number;
};

type ListEntry = {
  poi: POI;
  distanceKm?: number;
};

const RADIUS_OPTIONS = [5, 10, 25] as const;

const isValidLatLon = (lat: number, lon: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;

const formatDistance = (value: number) => {
  if (!Number.isFinite(value)) return "-- km";
  const rounded = value < 10 ? value.toFixed(1) : value.toFixed(0);
  return `${rounded} km`;
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
  const [showCities, setShowCities] = useState(true);
  const [showPois, setShowPois] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [zoom, setZoom] = useState(initialZoom);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(10);
  const mapRef = useRef<MapRef | null>(null);
  const searchParams = useSearchParams();
  const shareParam = searchParams.get("itinerary");
  const shareLoadedRef = useRef(false);
  const {
    selectedStops,
    optimizedStops,
    originCoordinates,
    settings,
    isPlanFull,
    maxStops,
    hydrated,
    toggleStop,
    loadFromShare,
  } = useItinerary();

  const chipClassName = useCallback(
    (isActive: boolean) =>
      `rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] transition ${
        isActive
          ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-100"
          : "border-white/10 text-slate-300 hover:border-white/30"
      }`,
    []
  );

  const filteredPois = useMemo(() => {
    if (activeCategory === "all") return pois;
    return pois.filter((poi) => poi.category === activeCategory);
  }, [pois, activeCategory]);

  const selectedPoi = useMemo(() => {
    if (!selectedPoiId) return null;
    return pois.find((poi) => poi.id === selectedPoiId) ?? null;
  }, [pois, selectedPoiId]);

  // Set NEXT_PUBLIC_MAP_STYLE_URL to a vector style with labels, e.g.
  // https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY
  const mapStyleEnv = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  const mapStyle =
    mapStyleEnv || "https://demotiles.maplibre.org/style.json";

  const hasPois = pois.length > 0;
  const featuredCitiesGeoJson = useMemo(
    () => buildFeaturedCitiesGeoJson(),
    []
  );
  const selectedStopIds = useMemo(
    () => new Set(selectedStops.map((stop) => stop.id)),
    [selectedStops]
  );
  const routeCoordinates = useMemo(() => {
    if (!optimizedStops?.length) return [];
    const coordinates: [number, number][] = [
      [originCoordinates.lon, originCoordinates.lat],
      ...optimizedStops.map((stop) => [stop.lon, stop.lat] as [number, number]),
    ];
    if (settings.roundTrip) {
      coordinates.push([originCoordinates.lon, originCoordinates.lat]);
    }
    return coordinates;
  }, [optimizedStops, originCoordinates, settings.roundTrip]);
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
  const itineraryStopsGeoJson = useMemo(() => {
    if (!optimizedStops?.length) return null;
    return {
      type: "FeatureCollection" as const,
      features: optimizedStops.map((stop, index) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [stop.lon, stop.lat],
        },
        properties: {
          index: index + 1,
          isStart: index === 0,
          isEnd: index === optimizedStops.length - 1,
        },
      })),
    };
  }, [optimizedStops]);
  const poisGeoJson = useMemo(() => {
    const features = pois
      .filter((poi) => isValidLatLon(poi.lat, poi.lon))
      .map((poi) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [poi.lon, poi.lat],
        },
        properties:
          typeof poi.rating === "number" ? { rating: poi.rating } : {},
      }));
    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [pois]);
  const cityVisibilityFilter = useMemo<FilterSpecification>(() => {
    if (zoom < 4) {
      return ["==", ["get", "isCapital"], true];
    }
    if (zoom < 6) {
      return [
        "any",
        ["==", ["get", "isCapital"], true],
        ["<=", ["get", "groupRank"], 3],
      ];
    }
    return ["!=", ["get", "name"], ""];
  }, [zoom]);
  const nearbyPoiEntries = useMemo<NearbyPoiEntry[]>(() => {
    if (!selectedCity) return [];
    const centerPoint = { lat: selectedCity.lat, lon: selectedCity.lon };
    return pois
      .filter((poi) => isValidLatLon(poi.lat, poi.lon))
      .map((poi) => ({
        poi,
        distanceKm: haversineKm(centerPoint, poi),
      }))
      .filter((entry) => entry.distanceKm <= nearbyRadiusKm)
      .sort((a, b) => {
        const distanceDiff = a.distanceKm - b.distanceKm;
        if (distanceDiff !== 0) return distanceDiff;
        return (b.poi.rating ?? 0) - (a.poi.rating ?? 0);
      });
  }, [nearbyRadiusKm, pois, selectedCity]);
  const nearbyVisiblePois = useMemo(() => {
    if (!selectedCity) return [];
    if (activeCategory === "all") return nearbyPoiEntries;
    return nearbyPoiEntries.filter(
      (entry) => entry.poi.category === activeCategory
    );
  }, [activeCategory, nearbyPoiEntries, selectedCity]);
  const visiblePois = useMemo(
    () =>
      selectedCity
        ? nearbyVisiblePois.map((entry) => entry.poi)
        : filteredPois,
    [filteredPois, nearbyVisiblePois, selectedCity]
  );
  const listEntries = useMemo<ListEntry[]>(() => {
    if (selectedCity) {
      return nearbyVisiblePois.slice(0, 8).map((entry) => ({
        poi: entry.poi,
        distanceKm: entry.distanceKm,
      }));
    }
    return filteredPois.map((poi) => ({ poi }));
  }, [filteredPois, nearbyVisiblePois, selectedCity]);
  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    const cityMatches: SelectedCity[] = [];
    for (const feature of featuredCitiesGeoJson.features) {
      const props = feature.properties;
      if (!props?.name) continue;
      const name = props.name.trim();
      if (!name) continue;
      if (!name.toLowerCase().includes(query)) continue;
      const [lon, lat] = feature.geometry.coordinates;
      cityMatches.push({ ...props, lat, lon });
    }

    const poiMatches: POI[] = [];
    for (const poi of pois) {
      const nameMatch = poi.name.toLowerCase().includes(query);
      const addressMatch = poi.address
        ? poi.address.toLowerCase().includes(query)
        : false;
      if (!nameMatch && !addressMatch) continue;
      poiMatches.push(poi);
    }

    const results: SearchResult[] = cityMatches
      .slice(0, 8)
      .map((city) => ({ type: "city", city }));
    const remaining = 8 - results.length;
    if (remaining > 0) {
      results.push(
        ...poiMatches
          .slice(0, remaining)
          .map((poi) => ({ type: "poi" as const, poi }))
      );
    }

    return results;
  }, [featuredCitiesGeoJson.features, pois, searchQuery]);
  const handleMapMove = useCallback((event: ViewStateChangeEvent) => {
    setZoom(event.viewState.zoom);
  }, []);

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

  const handleSelectCity = useCallback((city: SelectedCity) => {
    setSelectedCity(city);
    setSearchQuery("");
    const map = mapRef.current?.getMap();
    if (!map) return;
    const currentZoom = map.getZoom();
    map.flyTo({
      center: [city.lon, city.lat],
      zoom: Math.max(currentZoom, 6),
      essential: true,
    });
  }, []);

  const handleClearSelectedCity = useCallback(() => {
    setSelectedCity(null);
  }, []);

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      if (result.type === "city") {
        handleSelectCity(result.city);
        return;
      }
      setActiveCategory("all");
      setSelectedCity(null);
      selectPoi(result.poi.id);
      handleCenterPoi(result.poi);
      setSearchQuery("");
    },
    [handleCenterPoi, handleSelectCity, selectPoi]
  );
  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (!showCities) return;
      const map = mapRef.current?.getMap();
      if (!map) return;
      const features = map.queryRenderedFeatures(event.point, {
        layers: ["city-clusters", "city-dots", "city-labels"],
      });
      if (!features.length) return;

      const clusterFeature = features.find(
        (feature) => feature.layer.id === "city-clusters"
      );
      if (clusterFeature && clusterFeature.geometry.type === "Point") {
        const [lon, lat] = clusterFeature.geometry.coordinates as [
          number,
          number,
        ];
        const clusterIdValue = clusterFeature.properties?.cluster_id;
        const clusterId = Number(clusterIdValue);
        if (!Number.isFinite(clusterId)) return;
        const source = map.getSource("featured-cities") as
          | maplibregl.GeoJSONSource
          | undefined;
        if (!source?.getClusterExpansionZoom) return;
        (source.getClusterExpansionZoom as (id: number, cb: (err: Error | null, zoom?: number) => void) => void)(
          clusterId,
          (error: Error | null, expansionZoom?: number) => {
            if (error) return;
            const nextZoom = Number.isFinite(expansionZoom)
              ? expansionZoom
              : Math.max(map.getZoom(), 6);
            map.flyTo({
              center: [lon, lat],
              zoom: nextZoom,
              essential: true,
            });
          }
        );
        return;
      }

      const cityFeature = features.find((feature) =>
        ["city-dots", "city-labels"].includes(feature.layer.id)
      );
      if (!cityFeature || cityFeature.geometry.type !== "Point") return;
      const [lon, lat] = cityFeature.geometry.coordinates as [number, number];
      const props = cityFeature.properties ?? {};
      const name =
        typeof props.name === "string"
          ? props.name
          : String(props.name ?? "");
      const countryCode =
        typeof props.countryCode === "string"
          ? props.countryCode
          : String(props.countryCode ?? "");
      if (!name || !countryCode) return;
      const city: SelectedCity = {
        id:
          typeof props.id === "string"
            ? props.id
            : `${countryCode}-${name}`,
        name,
        countryCode,
        lat,
        lon,
        isCapital: props.isCapital === true || props.isCapital === "true",
        groupRank: Number(props.groupRank ?? 0),
        rank: Number(props.rank ?? 0),
      };
      handleSelectCity(city);
    },
    [handleSelectCity, showCities]
  );

  const handleReset = () => {
    setActiveCategory("all");
    setSelectedCity(null);
    setSearchQuery("");
    setNearbyRadiusKm(10);
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

  const visiblePoiIds = useMemo(
    () => new Set(visiblePois.map((poi) => poi.id)),
    [visiblePois]
  );

  useEffect(() => {
    if (!selectedPoiId) return;
    const stillVisible = visiblePoiIds.has(selectedPoiId);
    if (!stillVisible) {
      setIsPoiDrawerOpen(false);
      setSelectedPoiId(null);
    }
  }, [selectedPoiId, visiblePoiIds]);

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

  useEffect(() => {
    setZoom(initialZoom);
  }, [initialZoom]);

  useEffect(() => {
    if (mapStyleEnv || process.env.NODE_ENV !== "development") return;
    console.warn(
      "Using the MapLibre demo style. Set NEXT_PUBLIC_MAP_STYLE_URL for a basemap with city labels."
    );
  }, [mapStyleEnv]);

  const showSearchResults = searchQuery.trim().length >= 2;
  const hasNearbyResults = selectedCity ? nearbyVisiblePois.length > 0 : false;
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
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCities((prev) => !prev)}
            className={chipClassName(showCities)}
          >
            Städte
          </button>
          <button
            type="button"
            onClick={() => setShowPois((prev) => !prev)}
            className={chipClassName(showPois)}
          >
            POIs
          </button>
          <button
            type="button"
            onClick={() => setShowRoute((prev) => !prev)}
            className={chipClassName(showRoute)}
          >
            Route
          </button>
          <button
            type="button"
            onClick={() => setShowHeatmap((prev) => !prev)}
            className={chipClassName(showHeatmap)}
          >
            Heatmap
          </button>
        </div>

        <div className="mt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Suche Stadt oder Ort..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30"
              aria-label="Suche Stadt oder Ort"
            />
            {showSearchResults ? (
              <div className="absolute left-0 right-0 z-10 mt-2 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
                {searchResults.length ? (
                  <div className="space-y-1">
                    {searchResults.map((result) => {
                      const isCity = result.type === "city";
                      const title = isCity
                        ? result.city.name
                        : result.poi.name;
                      const subtitle = isCity
                        ? result.city.countryCode
                        : result.poi.category;
                      return (
                        <button
                          key={`${result.type}-${isCity ? result.city.id : result.poi.id}`}
                          type="button"
                          onClick={() => handleSearchSelect(result)}
                          className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-white">{title}</span>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                              {isCity ? "Stadt" : "Ort"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-3 py-2 text-xs text-slate-400">
                    Keine Treffer.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", ...PLACE_CATEGORIES] as const).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={chipClassName(activeCategory === category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3 overflow-y-auto pr-2 text-sm text-white md:max-h-[calc(100vh-20rem)]">
          {selectedCity ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    In der Naehe von
                  </p>
                  <p className="mt-1 text-sm text-white">
                    {selectedCity.name}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelectedCity}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  Zurück
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((radius) => (
                  <button
                    key={`radius-${radius}`}
                    type="button"
                    onClick={() => setNearbyRadiusKm(radius)}
                    className={chipClassName(nearbyRadiusKm === radius)}
                  >
                    {radius} km
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {nearbyVisiblePois.length} Orte im Umkreis
              </p>
            </div>
          ) : null}
          {listEntries.map((entry) => {
            const poi = entry.poi;
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{poi.name}</p>
                      {poi.rating ? (
                        <Badge className="bg-white/10 text-white">
                          {poi.rating.toFixed(1)}
                        </Badge>
                      ) : null}
                      {typeof entry.distanceKm === "number" ? (
                        <Badge className="bg-white/10 text-white">
                          {formatDistance(entry.distanceKm)}
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
          ) : selectedCity ? (
            !hasNearbyResults ? (
              <p className="text-sm text-slate-400">Keine Orte im Umkreis.</p>
            ) : null
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
          onMove={handleMapMove}
          onClick={handleMapClick}
        >
          <NavigationControl position="top-right" />
          {showHeatmap ? (
            <Source id="poi-heatmap" type="geojson" data={poisGeoJson}>
              <Layer
                id="poi-heatmap-layer"
                type="heatmap"
                paint={{
                  "heatmap-weight": [
                    "case",
                    ["has", "rating"],
                    ["interpolate", ["linear"], ["get", "rating"], 0, 0, 5, 1],
                    1,
                  ],
                  "heatmap-intensity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    0,
                    0.8,
                    9,
                    1.4,
                    12,
                    1.8,
                  ],
                  "heatmap-color": [
                    "interpolate",
                    ["linear"],
                    ["heatmap-density"],
                    0,
                    "rgba(15, 23, 42, 0)",
                    0.2,
                    "rgba(14, 116, 144, 0.35)",
                    0.5,
                    "rgba(34, 211, 238, 0.55)",
                    0.8,
                    "rgba(59, 130, 246, 0.7)",
                    1,
                    "rgba(14, 116, 144, 0.85)",
                  ],
                  "heatmap-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    0,
                    12,
                    9,
                    22,
                    12,
                    36,
                  ],
                  "heatmap-opacity": 0.7,
                }}
              />
            </Source>
          ) : null}
          {showRoute && routeCoordinates.length >= 2 ? (
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
          {showRoute && optimizedStops?.length ? (
            <Marker
              longitude={originCoordinates.lon}
              latitude={originCoordinates.lat}
              anchor="bottom"
            >
              <div className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-300 text-[10px] font-semibold text-emerald-950 shadow-lg">
                Start
              </div>
            </Marker>
          ) : null}
          {showRoute && itineraryStopsGeoJson ? (
            <Source id="itinerary-stops" type="geojson" data={itineraryStopsGeoJson}>
              <Layer
                id="itinerary-stops-dots"
                type="circle"
                paint={{
                  "circle-radius": [
                    "case",
                    ["any", ["get", "isStart"], ["get", "isEnd"]],
                    7,
                    6,
                  ],
                  "circle-color": [
                    "case",
                    ["get", "isStart"],
                    "#34d399",
                    ["get", "isEnd"],
                    "#fb923c",
                    "#22d3ee",
                  ],
                  "circle-stroke-color": "rgba(15, 23, 42, 0.85)",
                  "circle-stroke-width": 1,
                }}
              />
              <Layer
                id="itinerary-stops-labels"
                type="symbol"
                layout={{
                  "text-field": ["to-string", ["get", "index"]],
                  "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                  "text-size": 12,
                  "text-anchor": "center",
                  "text-allow-overlap": true,
                }}
                paint={{
                  "text-color": "#0f172a",
                  "text-halo-color": "rgba(255, 255, 255, 0.9)",
                  "text-halo-width": 1,
                }}
              />
            </Source>
          ) : null}
          {showCities ? (
            <Source
              id="featured-cities"
              type="geojson"
              data={featuredCitiesGeoJson}
              cluster
              clusterMaxZoom={6}
              clusterRadius={40}
            >
              <Layer
                id="city-clusters"
                type="circle"
                filter={["has", "point_count"]}
                paint={{
                  "circle-color": "#22d3ee",
                  "circle-opacity": 0.75,
                  "circle-stroke-color": "rgba(255, 255, 255, 0.85)",
                  "circle-stroke-width": 1.5,
                  "circle-radius": [
                    "step",
                    ["get", "point_count"],
                    14,
                    10,
                    18,
                    25,
                    24,
                    50,
                    30,
                  ],
                }}
              />
              <Layer
                id="city-cluster-count"
                type="symbol"
                filter={["has", "point_count"]}
                layout={{
                  "text-field": ["get", "point_count_abbreviated"],
                  "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                  "text-size": 12,
                }}
                paint={{
                  "text-color": "#0f172a",
                  "text-halo-color": "rgba(255, 255, 255, 0.9)",
                  "text-halo-width": 1,
                }}
              />
              <Layer
                id="city-dots"
                type="circle"
                filter={[
                  "all",
                  ["!", ["has", "point_count"]],
                  cityVisibilityFilter as any,
                ]}
                paint={{
                  "circle-radius": [
                    "+",
                    [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      2,
                      2.5,
                      6,
                      4.5,
                      10,
                      6,
                    ],
                    ["case", ["==", ["get", "isCapital"], true], 1, 0],
                  ],
                  "circle-color": "#38bdf8",
                  "circle-stroke-color": "rgba(255, 255, 255, 0.75)",
                  "circle-stroke-width": 1,
                  "circle-opacity": 0.9,
                }}
              />
              <Layer
                id="city-labels"
                type="symbol"
                filter={[
                  "all",
                  ["!", ["has", "point_count"]],
                  cityVisibilityFilter as any,
                ]}
                layout={{
                  "text-field": ["get", "name"],
                  "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
                  "text-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    2,
                    10,
                    6,
                    12,
                    10,
                    14,
                  ],
                  "text-offset": [0, 0.8],
                  "text-anchor": "top",
                  "text-variable-anchor": ["top", "bottom", "left", "right"],
                  "text-allow-overlap": false,
                  "symbol-sort-key": ["get", "rank"],
                }}
                paint={{
                  "text-color": "#e2e8f0",
                  "text-halo-color": "rgba(2, 6, 23, 0.85)",
                  "text-halo-width": 1.25,
                  "text-opacity": 0.95,
                }}
              />
            </Source>
          ) : null}
          {showPois
            ? visiblePois.map((poi) => {
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
                      className="group relative flex h-8 w-8 items-center justify-center"
                    >
                      {isSelected ? (
                        <span className="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-cyan-300/30 opacity-75" />
                      ) : null}
                      <span
                        className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-white/80 shadow-lg transition ${
                          isSelected
                            ? "bg-cyan-200 text-slate-900 scale-110"
                            : "bg-slate-950/90 text-cyan-100"
                        }`}
                      >
                        <PoiCategoryIcon
                          category={poi.category}
                          active={isSelected}
                        />
                      </span>
                    </button>
                  </Marker>
                );
              })
            : null}
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
  <ItineraryProvider defaultOrigin={props.defaultCenter}>
    <MapViewContent {...props} />
  </ItineraryProvider>
);

export default MapView;
