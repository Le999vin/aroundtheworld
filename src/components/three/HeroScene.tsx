"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

type HeroSceneProps = {
  className?: string;
};

type ShapeConfig = {
  type: "sphere" | "torus" | "icosa";
  position: [number, number, number];
  scale: number;
  color: string;
};

function FloatingShape({ config }: { config: ShapeConfig }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.x = clock.elapsedTime * 0.08;
    ref.current.rotation.y = clock.elapsedTime * 0.12;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.5} floatIntensity={0.6}>
      <mesh ref={ref} position={config.position} scale={config.scale}>
        {config.type === "sphere" ? (
          <sphereGeometry args={[1, 48, 48]} />
        ) : config.type === "torus" ? (
          <torusGeometry args={[0.9, 0.25, 32, 64]} />
        ) : (
          <icosahedronGeometry args={[1, 1]} />
        )}
        <meshStandardMaterial
          color={config.color}
          metalness={0.25}
          roughness={0.2}
          transparent
          opacity={0.55}
        />
      </mesh>
    </Float>
  );
}

function Scene() {
  const group = useRef<THREE.Group>(null);
  const { size, pointer } = useThree();
  const isMobile = size.width < 768;

  const shapes = useMemo<ShapeConfig[]>(
    () =>
      isMobile
        ? [
            {
              type: "sphere",
              position: [-1.8, 0.2, 0],
              scale: 0.85,
              color: "#8bd3ff",
            },
            {
              type: "torus",
              position: [1.6, -0.4, -0.2],
              scale: 0.75,
              color: "#9af0d8",
            },
            {
              type: "icosa",
              position: [0.2, 1.1, -0.5],
              scale: 0.65,
              color: "#93c5fd",
            },
          ]
        : [
            {
              type: "sphere",
              position: [-2.6, 0.6, -0.4],
              scale: 1,
              color: "#8bd3ff",
            },
            {
              type: "torus",
              position: [2.3, -0.8, 0.2],
              scale: 0.9,
              color: "#9af0d8",
            },
            {
              type: "icosa",
              position: [0.4, 1.6, -0.8],
              scale: 0.75,
              color: "#b3b5ff",
            },
            {
              type: "sphere",
              position: [0.8, -1.6, -0.3],
              scale: 0.65,
              color: "#ffd6a5",
            },
            {
              type: "torus",
              position: [-1.2, -1.4, 0.3],
              scale: 0.6,
              color: "#86efac",
            },
          ],
    [isMobile]
  );

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      pointer.y * 0.3,
      0.05
    );
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      pointer.x * 0.4,
      0.05
    );
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 4]} intensity={0.8} />
      {shapes.map((shape, index) => (
        <FloatingShape key={`${shape.type}-${index}`} config={shape} />
      ))}
    </group>
  );
}

export default function HeroScene({ className }: HeroSceneProps) {
  return (
    <div className={cn("absolute inset-0", className)}>
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 7], fov: 50 }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}

