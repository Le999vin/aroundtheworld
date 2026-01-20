// der “echte” Globus (globe.gl + Three.js)
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import {
  getCountryCode as getGeoCountryCode,
  getCountryName,
  type CountriesGeoJson,
  type CountryFeature,
} from "@/lib/countries/geo";
import { resolveCountryCode } from "@/lib/countries/countryMeta";

const DEFAULT_FILL = "rgba(15, 23, 42, 0.35)";
const HOVER_FILL = "rgba(94, 234, 212, 0.6)";
const SELECT_FILL = "rgba(56, 189, 248, 0.75)";
const SIDE_COLOR = "rgba(226, 232, 240, 0.05)";
const STROKE_COLOR = "rgba(148, 163, 184, 0.08)";
const BACKGROUND_COLOR = "#0b1220";
const BASE_GLOBE_COLOR = "#0b1220";
const EARTH_TEXTURE_URL = "/textures/earth-blue-marble.jpg";
const EARTH_BUMP_URL = "/textures/earth-topology.png";
const MAX_DPR = 2;
const DEBUG_POLYGON_UPDATES = false;
const POLYGON_ALTITUDE = 0.012;
const POLYGONS_TRANSITION_MS = 0;
const POLYGON_OFFSET_FACTOR = 1;
const POLYGON_OFFSET_UNITS = 1;
const POLYGON_STROKE_RENDER_ORDER = 2;
const CAMERA_ALTITUDE = 2.1;
const CAMERA_ANIMATION_MS = 900;

type LoadedTextures = {
  earth: THREE.Texture;
  bump: THREE.Texture;
};

const loadTexture = (
  loader: THREE.TextureLoader,
  url: string
): Promise<THREE.Texture> =>
  new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });

const clampOpacity = (value: number) => Math.min(1, Math.max(0, value));

const parseColorWithOpacity = (value: string) => {
  const trimmed = value.trim();
  const rgbaMatch = trimmed.match(/^rgba?\((.+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((part) => part.trim());
    const [r, g, b, a] = parts;
    const rNum = Number.parseFloat(r);
    const gNum = Number.parseFloat(g);
    const bNum = Number.parseFloat(b);
    const rawOpacity =
      a === undefined ? 1 : Number.parseFloat(a);
    const opacity = Number.isFinite(rawOpacity)
      ? clampOpacity(rawOpacity)
      : 1;
    if (
      Number.isFinite(rNum) &&
      Number.isFinite(gNum) &&
      Number.isFinite(bNum)
    ) {
      return {
        color: new THREE.Color(`rgb(${rNum}, ${gNum}, ${bNum})`),
        opacity,
        transparent: opacity < 1,
      };
    }
  }
  return { color: new THREE.Color(trimmed), opacity: 1, transparent: false };
};

const createPolygonMaterial = (
  colorValue: string,
  {
    polygonOffsetFactor = POLYGON_OFFSET_FACTOR,
    polygonOffsetUnits = POLYGON_OFFSET_UNITS,
  }: {
    polygonOffsetFactor?: number;
    polygonOffsetUnits?: number;
  } = {}
) => {
  const { color, opacity, transparent } = parseColorWithOpacity(colorValue);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent,
    opacity,
    depthTest: true,
    depthWrite: !transparent,
    polygonOffset: true,
    polygonOffsetFactor,
    polygonOffsetUnits,
  });
  material.alphaTest = 0;
  return material;
};

const getGlobeObjectType = (object: THREE.Object3D) => {
  let current: THREE.Object3D | null = object;
  while (
    current &&
    !Object.prototype.hasOwnProperty.call(current, "__globeObjType")
  ) {
    current = current.parent;
  }
  const type = (current as { __globeObjType?: string } | null)?.__globeObjType;
  return typeof type === "string" ? type : null;
};

const configurePolygonStrokeMaterials = (
  scene: THREE.Scene,
  colorValue: string
) => {
  const { color, opacity, transparent } = parseColorWithOpacity(colorValue);
  scene.traverse((obj) => {
    const isLine =
      (obj as THREE.Line).isLine || (obj as THREE.LineSegments).isLineSegments;
    if (!isLine) return;
    if (getGlobeObjectType(obj) !== "polygon") return;
    const materials = Array.isArray((obj as THREE.Line).material)
      ? (obj as THREE.Line).material
      : [(obj as THREE.Line).material];
    const materialList = Array.isArray(materials) ? materials : [materials];
    materialList.forEach((material) => {
      if (!material || Array.isArray(material)) return;
      const materialWithColor = material as THREE.Material & {
        color?: THREE.Color;
      };
      if (materialWithColor.color) {
        materialWithColor.color.copy(color);
      }
      material.transparent = transparent;
      material.opacity = opacity;
      material.depthTest = true;
      material.depthWrite = false;
      material.polygonOffset = false;
      material.polygonOffsetFactor = 0;
      material.polygonOffsetUnits = 0;
      material.needsUpdate = true;
    });
    obj.renderOrder = POLYGON_STROKE_RENDER_ORDER;
  });
};

const normalizeCountryCodeCandidate = (
  value: string | number | null | undefined
) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "-99") return null;
  return trimmed.toUpperCase();
};

const getResolvedCountryCode = (poly: CountryFeature | null): string | null => {
  if (!poly) return null;
  const rawCode = getGeoCountryCode(poly);
  const normalized = normalizeCountryCodeCandidate(rawCode);
  const name = getCountryName(poly);
  const resolved =
    (normalized ? resolveCountryCode(normalized) : null) ??
    resolveCountryCode(name);
  return resolved ?? normalized;
};

type GlobeGLProps = {
  countries: CountriesGeoJson;
  selectedCountry?: { lat: number; lon: number } | null;
  selectedCountryCode?: string | null;
  onSelectCountry?: (countryCode: string | null) => void;
  onHoverCountry?: (countryCode: string | null) => void;
};

export default function GlobeGL({
  countries,
  selectedCountry,
  selectedCountryCode,
  onSelectCountry,
  onHoverCountry,
}: GlobeGLProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<InstanceType<typeof Globe> | null>(null);
  const capMaterialCacheRef =
    useRef<Map<string, THREE.MeshBasicMaterial> | null>(null);
  const sideMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const hoveredCodeRef = useRef<string | null>(null);
  const selectedCodeRef = useRef<string | null>(selectedCountryCode ?? null);
  const lastFocusRef = useRef<string | null>(null);
  const selectedCountryRef = useRef<{ lat: number; lon: number } | null>(
    selectedCountry ?? null
  );
  const polygonUpdateCountRef = useRef(0);
  const selectedLat = selectedCountry?.lat;
  const selectedLon = selectedCountry?.lon;
  const hasSelection =
    Number.isFinite(selectedLat) && Number.isFinite(selectedLon);
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

  useEffect(() => {
    if (!DEBUG_POLYGON_UPDATES) return;
    const interval = window.setInterval(() => {
      const count = polygonUpdateCountRef.current;
      polygonUpdateCountRef.current = 0;
      console.info(`[globe] updatePolygonColors: ${count}/s`);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const resolveCapColor = useCallback((poly: object) => {
    const feature = poly as CountryFeature;
    const code = getResolvedCountryCode(feature);
    if (code && selectedCodeRef.current === code) return SELECT_FILL;
    if (code && hoveredCodeRef.current === code) return HOVER_FILL;
    return DEFAULT_FILL;
  }, []);

  const getCapMaterial = useCallback(
    (poly: object) => {
      const color = resolveCapColor(poly);
      if (!capMaterialCacheRef.current) {
        capMaterialCacheRef.current = new Map();
      }
      const cache = capMaterialCacheRef.current;
      const cached = cache.get(color);
      if (cached) return cached;
      const material = createPolygonMaterial(color);
      cache.set(color, material);
      return material;
    },
    [resolveCapColor]
  );

  const updatePolygonColors = useCallback(() => {
    if (!globeRef.current) return;
    if (DEBUG_POLYGON_UPDATES) {
      polygonUpdateCountRef.current += 1;
    }
    globeRef.current.polygonCapMaterial(getCapMaterial);
  }, [getCapMaterial]);

  useEffect(() => {
    selectedCodeRef.current = selectedCountryCode ?? null;
    updatePolygonColors();
  }, [selectedCountryCode, updatePolygonColors]);

  useEffect(() => {
    selectedCountryRef.current = selectedCountry ?? null;
  }, [selectedCountry]);

  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = !hasSelection;
  }, [hasSelection]);

  useEffect(() => {
    if (!globeRef.current || !hasSelection) return;
    const lat = selectedLat as number;
    const lon = selectedLon as number;
    const nextKey = `${lat}:${lon}`;
    if (lastFocusRef.current === nextKey) return;
    lastFocusRef.current = nextKey;
    globeRef.current.pointOfView(
      { lat, lng: lon, altitude: CAMERA_ALTITUDE },
      CAMERA_ANIMATION_MS
    );
  }, [hasSelection, selectedLat, selectedLon]);

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

    const createGlobe = Globe as unknown as () => (
      element: HTMLElement
    ) => InstanceType<typeof Globe>;
    const g = createGlobe()(node);

    let cancelled = false;
    let loadedTextures: LoadedTextures | null = null;

    g.backgroundColor(BACKGROUND_COLOR)
      .showAtmosphere(true)
      .atmosphereColor("#38bdf8")
      .atmosphereAltitude(0.16);

    const globeMaterial = g.globeMaterial() as THREE.MeshPhongMaterial;
    globeMaterial.color = new THREE.Color(BASE_GLOBE_COLOR);
    globeMaterial.emissive = new THREE.Color("#020617");
    globeMaterial.emissiveIntensity = 0.2;

    capMaterialCacheRef.current = new Map();
    const sideMaterial =
      sideMaterialRef.current ?? createPolygonMaterial(SIDE_COLOR);
    sideMaterialRef.current = sideMaterial;

    g.polygonsData(features)
      .polygonAltitude(POLYGON_ALTITUDE)
      .polygonCapMaterial(getCapMaterial)
      .polygonSideMaterial(sideMaterial)
      .polygonStrokeColor(() => STROKE_COLOR)
      .polygonsTransitionDuration(POLYGONS_TRANSITION_MS);

    requestAnimationFrame(() => {
      if (cancelled) return;
      configurePolygonStrokeMaterials(g.scene(), STROKE_COLOR);
    });

    g.onPolygonHover((poly: object | null) => {
      const feature = poly as CountryFeature | null;
      const code = feature ? getResolvedCountryCode(feature) : null;
      const name = feature ? getCountryName(feature) : null;
      const nextCode = code ?? null;
      if (hoveredCodeRef.current === nextCode) return;
      hoveredCodeRef.current = nextCode;
      setHoveredName(name ?? null);
      callbacksRef.current.onHoverCountry?.(nextCode);
      updatePolygonColors();
    });

    g.onPolygonClick((poly: object | null) => {
      const feature = poly as CountryFeature | null;
      const code = feature ? getResolvedCountryCode(feature) : null;
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

    g.pointOfView({ lat: 20, lng: 0, altitude: CAMERA_ALTITUDE }, 0);

    const renderer = g.renderer();
    renderer.setClearColor(BACKGROUND_COLOR, 1);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, MAX_DPR)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const configureTexture = (
      texture: THREE.Texture,
      options: { colorSpace?: THREE.ColorSpace; anisotropy: number }
    ) => {
      if (options.colorSpace) {
        texture.colorSpace = options.colorSpace;
      }
      texture.anisotropy = options.anisotropy;
      texture.minFilter = THREE.LinearMipMapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    };

    const loadTextures = async () => {
      const loader = new THREE.TextureLoader();
      const [earth, bump] = await Promise.all([
        loadTexture(loader, EARTH_TEXTURE_URL),
        loadTexture(loader, EARTH_BUMP_URL),
      ]);
      const anisotropy = renderer.capabilities.getMaxAnisotropy();
      configureTexture(earth, {
        colorSpace: THREE.SRGBColorSpace,
        anisotropy,
      });
      configureTexture(bump, { anisotropy });
      return { earth, bump };
    };

    const setupTextures = async () => {
      try {
        const textures = await loadTextures();
        if (cancelled) {
          textures.earth.dispose();
          textures.bump.dispose();
          return;
        }
        loadedTextures = textures;
        globeMaterial.map = textures.earth;
        globeMaterial.bumpMap = textures.bump;
        globeMaterial.bumpScale = 0.4;
        globeMaterial.needsUpdate = true;
      } catch (error) {
        console.error("Failed to load globe textures.", error);
      }
    };

    void setupTextures();

    const updateSize = () => {
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, MAX_DPR)
      );
      g.width(node.clientWidth);
      g.height(node.clientHeight);
    };

    const ro = new ResizeObserver(updateSize);
    ro.observe(node);
    updateSize();

    globeRef.current = g;
    const initialTarget = selectedCountryRef.current;
    if (
      initialTarget &&
      Number.isFinite(initialTarget.lat) &&
      Number.isFinite(initialTarget.lon)
    ) {
      const focusKey = `${initialTarget.lat}:${initialTarget.lon}`;
      lastFocusRef.current = focusKey;
      g.pointOfView(
        { lat: initialTarget.lat, lng: initialTarget.lon, altitude: CAMERA_ALTITUDE },
        0
      );
      controls.autoRotate = false;
    }

    return () => {
      cancelled = true;
      ro.disconnect();
      if (loadedTextures) {
        loadedTextures.earth.dispose();
        loadedTextures.bump.dispose();
        loadedTextures = null;
      }
      globeMaterial.map = null;
      globeMaterial.bumpMap = null;
      if (capMaterialCacheRef.current) {
        capMaterialCacheRef.current.forEach((material) => material.dispose());
        capMaterialCacheRef.current.clear();
        capMaterialCacheRef.current = null;
      }
      if (sideMaterialRef.current) {
        sideMaterialRef.current.dispose();
        sideMaterialRef.current = null;
      }
      const controls = g.controls();
      controls.dispose();
      renderer.dispose();
      globeRef.current = null;
      node.innerHTML = "";
    };
  }, [features, getCapMaterial, updatePolygonColors]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.polygonsData(features);
    updatePolygonColors();
    requestAnimationFrame(() => {
      if (globeRef.current !== globe) return;
      configurePolygonStrokeMaterials(globe.scene(), STROKE_COLOR);
    });
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
