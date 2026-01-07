"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import type { CountriesGeoJson, CountryFeature } from "@/lib/countries/geo";

const DEFAULT_FILL = "rgba(51, 65, 85, 0.85)";
const HOVER_FILL = "rgba(94, 234, 212, 0.95)";
const SELECT_FILL = "rgba(56, 189, 248, 0.95)";
const SIDE_COLOR = "rgba(226, 232, 240, 0.1)";
const STROKE_COLOR = "rgba(226, 232, 240, 0.1)";
const BACKGROUND_COLOR = "#0b1220";

const getCountryCode = (poly: CountryFeature | null): string | null => {
  if (!poly) return null;
  const props = poly.properties ?? {};
  const idValue =
    (props.ISO_A2 as string | undefined) ||
    (props.iso_a2 as string | undefined) ||
    (props.id as string | number | undefined) ||
    poly.id;
  if (idValue === undefined || idValue === null) return null;
  return String(idValue);
};

const getCountryName = (poly: CountryFeature | null): string | null => {
  if (!poly) return null;
  const props = poly.properties ?? {};
  const nameValue =
    (props.ADMIN as string | undefined) ||
    (props.name as string | undefined) ||
    (props.NAME as string | undefined) ||
    (props.name_en as string | undefined) ||
    (props.id as string | number | undefined) ||
    poly.id;
  if (nameValue === undefined || nameValue === null) return null;
  return String(nameValue);
};

type GlobeGLProps = {
  countries: CountriesGeoJson;
  selectedCountryCode?: string | null;
  onSelectCountry?: (countryCode: string | null) => void;
  onHoverCountry?: (countryCode: string | null) => void;
};

export default function GlobeGL({
  countries,
  selectedCountryCode,
  onSelectCountry,
  onHoverCountry,
}: GlobeGLProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<ReturnType<typeof Globe> | null>(null);
  const hoveredCodeRef = useRef<string | null>(null);
  const selectedCodeRef = useRef<string | null>(selectedCountryCode ?? null);
  const callbacksRef = useRef({ onSelectCountry, onHoverCountry });

  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const features = useMemo(
    () => (countries?.features ?? []) as CountryFeature[],
    [countries]
  );

  useEffect(() => {
    callbacksRef.current = { onSelectCountry, onHoverCountry };
  }, [onSelectCountry, onHoverCountry]);

  const resolveCapColor = useCallback((poly: CountryFeature) => {
    const code = getCountryCode(poly);
    if (code && selectedCodeRef.current === code) return SELECT_FILL;
    if (code && hoveredCodeRef.current === code) return HOVER_FILL;
    return DEFAULT_FILL;
  }, []);

  const updatePolygonColors = useCallback(() => {
    if (!globeRef.current) return;
    globeRef.current.polygonCapColor(resolveCapColor);
  }, [resolveCapColor]);

  useEffect(() => {
    selectedCodeRef.current = selectedCountryCode ?? null;
    updatePolygonColors();
  }, [selectedCountryCode, updatePolygonColors]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const handleMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    };

    const handleLeave = () => setCursor(null);

    node.addEventListener("mousemove", handleMove);
    node.addEventListener("mouseleave", handleLeave);

    return () => {
      node.removeEventListener("mousemove", handleMove);
      node.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    if (globeRef.current) return;

    const g = Globe()(node);

    g.backgroundColor(BACKGROUND_COLOR)
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
      .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
      .showAtmosphere(true)
      .atmosphereColor("#38bdf8")
      .atmosphereAltitude(0.18);

    g.polygonsData(features)
      .polygonAltitude(0.01)
      .polygonCapColor(resolveCapColor)
      .polygonSideColor(() => SIDE_COLOR)
      .polygonStrokeColor(() => STROKE_COLOR)
      .polygonsTransitionDuration(250);

    g.onPolygonHover((poly: CountryFeature | null) => {
      const code = getCountryCode(poly);
      const name = poly ? getCountryName(poly) : null;
      hoveredCodeRef.current = code ?? null;
      setHoveredName(name ?? null);
      callbacksRef.current.onHoverCountry?.(code ?? null);
      updatePolygonColors();
    });

    g.onPolygonClick((poly: CountryFeature | null) => {
      const code = getCountryCode(poly);
      if (!code) return;
      selectedCodeRef.current = code;
      updatePolygonColors();
      callbacksRef.current.onSelectCountry?.(code);
    });

    const controls = g.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.65;

    const radius = g.getGlobeRadius();
    controls.minDistance = radius * 1.2;
    controls.maxDistance = radius * 3;

    g.pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 0);

    const cloudsTexture = new THREE.TextureLoader().load(
      "//unpkg.com/three-globe/example/img/earth-clouds.png"
    );
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.01, 75, 75),
      new THREE.MeshPhongMaterial({ map: cloudsTexture, transparent: true })
    );
    g.scene().add(clouds);

    let frameId = 0;
    const animate = () => {
      clouds.rotation.y += 0.0006;
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const ro = new ResizeObserver(() => {
      g.width(node.clientWidth);
      g.height(node.clientHeight);
    });
    ro.observe(node);

    g.width(node.clientWidth);
    g.height(node.clientHeight);

    globeRef.current = g;

    return () => {
      ro.disconnect();
      cancelAnimationFrame(frameId);
      g.scene().remove(clouds);
      globeRef.current = null;
      node.innerHTML = "";
    };
  }, [features, resolveCapColor, updatePolygonColors]);

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.polygonsData(features);
    updatePolygonColors();
  }, [features, updatePolygonColors]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {hoveredName && cursor ? (
        <div
          className="pointer-events-none absolute z-20 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-xs tracking-wide text-slate-100 shadow-lg backdrop-blur"
          style={{
            left: cursor.x + 12,
            top: cursor.y + 12,
          }}
        >
          {hoveredName}
        </div>
      ) : null}
    </div>
  );
}
