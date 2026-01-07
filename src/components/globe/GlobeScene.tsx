"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import * as THREE from "three";
import GeoJsonGeometry from "three-geojson-geometry";
import {
  getCountryCode,
  getCountryName,
  getFeatureCenter,
  latLonToVector,
  type CountriesGeoJson,
  type CountryFeature,
} from "@/lib/countries/geo";
import { countryMetaByCode } from "@/lib/countries/countryMeta";
import type { Country } from "@/lib/types";

const RADIUS = 2.15;
const CAMERA_DISTANCE = 4.4;
const ATMOSPHERE_RADIUS = 2.3;
const BASE_COLOR = new THREE.Color("#334155");
const HOVER_COLOR = new THREE.Color("#5eead4");
const SELECT_COLOR = new THREE.Color("#38bdf8");

type HoverState = {
  country: Country;
  x: number;
  y: number;
} | null;

type CountryShape = {
  id: string;
  name: string;
  code: string;
  center: { lat: number; lon: number };
  geometry: THREE.BufferGeometry;
  country: Country;
};

type GlobeSceneProps = {
  countries: CountriesGeoJson;
  selectedCountry?: Country | null;
  onSelectCountry?: (country: Country) => void;
  onHoverCountry?: (country: Country | null) => void;
};

const buildCountry = (feature: CountryFeature): CountryShape => {
  const code = getCountryCode(feature);
  const name = getCountryName(feature);
  const center = getFeatureCenter(feature);
  const meta = code ? countryMetaByCode[code] : null;
  const country: Country = {
    code: code || name.slice(0, 2).toUpperCase(),
    name,
    lat: center.lat,
    lon: center.lon,
    capital: meta?.capital,
    population: meta?.population,
    topCities: meta?.topCities,
    topPlaces: meta?.topPlaces,
  };

  const geometry = new GeoJsonGeometry(feature, RADIUS, 4);
  geometry.computeVertexNormals();

  return {
    id: code || name,
    name,
    code: country.code,
    center,
    geometry,
    country,
  };
};

const FocusRig = ({
  controlsRef,
  target,
}: {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  target?: { lat: number; lon: number } | null;
}) => {
  const targetRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (target) {
      targetRef.current = latLonToVector(target.lat, target.lon, RADIUS);
    }
  }, [target]);

  useFrame(({ camera }, delta) => {
    if (!targetRef.current || !controlsRef.current) return;
    const easing = 1 - Math.exp(-delta * 3);
    const desiredTarget = targetRef.current;
    const desiredPosition = desiredTarget
      .clone()
      .normalize()
      .multiplyScalar(CAMERA_DISTANCE);

    camera.position.lerp(desiredPosition, easing);
    controlsRef.current.target.lerp(desiredTarget, easing);
    controlsRef.current.update();
  });

  return null;
};

const CountriesLayer = ({
  shapes,
  hoveredCode,
  selectedCode,
  onHover,
  onSelect,
  setHoverState,
}: {
  shapes: CountryShape[];
  hoveredCode?: string | null;
  selectedCode?: string | null;
  onHover?: (country: Country | null) => void;
  onSelect?: (country: Country) => void;
  setHoverState: Dispatch<SetStateAction<HoverState>>;
}) => {
  return shapes.map((shape) => {
    const isHovered = hoveredCode === shape.code;
    const isSelected = selectedCode === shape.code;
    const color = isSelected ? SELECT_COLOR : isHovered ? HOVER_COLOR : BASE_COLOR;

    return (
      <mesh
        key={shape.id}
        geometry={shape.geometry}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHoverState({
            country: shape.country,
            x: event.clientX,
            y: event.clientY,
          });
          onHover?.(shape.country);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          setHoverState((prev) =>
            prev
              ? { ...prev, x: event.clientX, y: event.clientY }
              : prev
          );
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHoverState(null);
          onHover?.(null);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(shape.country);
        }}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered || isSelected ? 0.35 : 0.05}
          metalness={0.1}
          roughness={0.75}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  });
};

const Earth = () => {
  return (
    <mesh>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial
        color="#334155"
        roughness={0.75}
        metalness={0.05}
        emissive="#0b1220"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
};

const Atmosphere = () => {
  return (
    <mesh>
      <sphereGeometry args={[ATMOSPHERE_RADIUS, 64, 64]} />
      <meshBasicMaterial
        color="#38bdf8"
        transparent
        opacity={0.18}
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export const GlobeScene = ({
  countries,
  selectedCountry,
  onSelectCountry,
  onHoverCountry,
}: GlobeSceneProps) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [hoverState, setHoverState] = useState<HoverState>(null);

  const shapes = useMemo(() => {
    const features = (countries?.features ?? []) as CountryFeature[];
    return features.map(buildCountry);
  }, [countries]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, CAMERA_DISTANCE], fov: 45 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0b1220"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 4, 6]} intensity={1.6} />
        <directionalLight position={[-6, -3, -6]} intensity={0.6} />
        <Suspense fallback={null}>
          <Earth />
          <CountriesLayer
            shapes={shapes}
            hoveredCode={hoverState?.country.code}
            selectedCode={selectedCountry?.code}
            onHover={onHoverCountry}
            onSelect={onSelectCountry}
            setHoverState={setHoverState}
          />
          <Atmosphere />
          <FocusRig controlsRef={controlsRef} target={selectedCountry} />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={3.1}
          maxDistance={6.5}
          autoRotate
          autoRotateSpeed={0.65}
        />
      </Canvas>

      {hoverState ? (
        <div
          className="pointer-events-none absolute z-20 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-xs tracking-wide text-slate-100 shadow-lg backdrop-blur"
          style={{
            left: hoverState.x + 12,
            top: hoverState.y + 12,
          }}
        >
          {hoverState.country.name}
        </div>
      ) : null}
    </div>
  );
};

export default GlobeScene;
