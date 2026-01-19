"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

type HeroSceneProps = {
  className?: string;
};

const BOUNDS = { x: 6, y: 6, z: 4 };
const DESKTOP = {
  count: 180,
  maxLines: 120,
  pointSize: 0.065,
  linkDistance: 1.8,
};
const MOBILE = {
  count: 120,
  maxLines: 80,
  pointSize: 0.055,
  linkDistance: 1.5,
};

function Scene() {
  const group = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const { size, pointer } = useThree();
  const reduceMotion = useReducedMotion();
  const isMobile = size.width < 768;
  const settings = isMobile ? MOBILE : DESKTOP;

  const { positions, velocities, linePositions } = useMemo(() => {
    const positionsArray = new Float32Array(settings.count * 3);
    const velocitiesArray = new Float32Array(settings.count * 3);

    for (let i = 0; i < settings.count; i += 1) {
      const idx = i * 3;
      positionsArray[idx] = THREE.MathUtils.randFloatSpread(BOUNDS.x * 2);
      positionsArray[idx + 1] = THREE.MathUtils.randFloatSpread(BOUNDS.y * 2);
      positionsArray[idx + 2] = THREE.MathUtils.randFloatSpread(BOUNDS.z * 2);

      velocitiesArray[idx] = (Math.random() - 0.5) * 0.04;
      velocitiesArray[idx + 1] = (Math.random() - 0.5) * 0.04;
      velocitiesArray[idx + 2] = (Math.random() - 0.5) * 0.03;
    }

    return {
      positions: positionsArray,
      velocities: velocitiesArray,
      linePositions: new Float32Array(settings.maxLines * 2 * 3),
    };
  }, [settings.count, settings.maxLines]);

  useFrame((state, delta) => {
    if (!pointsRef.current || !linesRef.current || !group.current) return;

    const motionScale = reduceMotion ? 0 : 1;
    const pointerScale = reduceMotion ? 0 : 1;

    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      pointer.y * 0.2 * pointerScale,
      0.05
    );
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      pointer.x * 0.3 * pointerScale,
      0.05
    );

    // Update particle positions (drift + wrap-around).
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += velocities[i] * delta * motionScale;
      positions[i + 1] += velocities[i + 1] * delta * motionScale;
      positions[i + 2] += velocities[i + 2] * delta * motionScale;

      if (positions[i] > BOUNDS.x) positions[i] = -BOUNDS.x;
      if (positions[i] < -BOUNDS.x) positions[i] = BOUNDS.x;
      if (positions[i + 1] > BOUNDS.y) positions[i + 1] = -BOUNDS.y;
      if (positions[i + 1] < -BOUNDS.y) positions[i + 1] = BOUNDS.y;
      if (positions[i + 2] > BOUNDS.z) positions[i + 2] = -BOUNDS.z;
      if (positions[i + 2] < -BOUNDS.z) positions[i + 2] = BOUNDS.z;
    }

    const pointsAttribute = pointsRef.current.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    pointsAttribute.needsUpdate = true;

    // Build line segments for nearby particles.
    let lineIndex = 0;
    const linkDistanceSq = settings.linkDistance * settings.linkDistance;
    const maxLineFloats = settings.maxLines * 6;

    outer: for (let i = 0; i < settings.count; i += 1) {
      const iIndex = i * 3;
      for (let j = i + 1; j < settings.count; j += 1) {
        const jIndex = j * 3;
        const dx = positions[iIndex] - positions[jIndex];
        const dy = positions[iIndex + 1] - positions[jIndex + 1];
        const dz = positions[iIndex + 2] - positions[jIndex + 2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < linkDistanceSq) {
          linePositions[lineIndex++] = positions[iIndex];
          linePositions[lineIndex++] = positions[iIndex + 1];
          linePositions[lineIndex++] = positions[iIndex + 2];
          linePositions[lineIndex++] = positions[jIndex];
          linePositions[lineIndex++] = positions[jIndex + 1];
          linePositions[lineIndex++] = positions[jIndex + 2];

          if (lineIndex >= maxLineFloats) {
            break outer;
          }
        }
      }
    }

    const lineAttribute = linesRef.current.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    lineAttribute.needsUpdate = true;
    linesRef.current.geometry.setDrawRange(0, lineIndex / 3);
  });

  return (
    <group ref={group}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={positions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          size={settings.pointSize}
          sizeAttenuation
          color="#8fe3ff"
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={linePositions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#9adfff"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </lineSegments>
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
