/**
 * LogoModel — Displays the core.glb 3D logo in the hero section.
 *
 * Behavior:
 * - Idle: gentle breathing sway (tiny Y oscillation + subtle X wobble)
 * - Mouse hover on canvas: model tilts toward cursor position interactively
 * - No full spin — the model stays front-facing, just tilting/reacting
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Float, ContactShadows } from "@react-three/drei";
import { Suspense, useRef, useState, useCallback } from "react";
import * as THREE from "three";

function Model({ hovered }: { hovered: boolean }) {
  const { scene } = useGLTF("/models/core.glb");
  const groupRef = useRef<THREE.Group>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const smoothRef = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Smooth lerp toward pointer target
    const lerpSpeed = hovered ? 0.06 : 0.03;
    smoothRef.current.x += (pointerRef.current.x - smoothRef.current.x) * lerpSpeed;
    smoothRef.current.y += (pointerRef.current.y - smoothRef.current.y) * lerpSpeed;

    if (hovered) {
      // Interactive: tilt toward mouse — max ~15 degrees each axis
      groupRef.current.rotation.y = smoothRef.current.x * 0.26;
      groupRef.current.rotation.x = -smoothRef.current.y * 0.15;
    } else {
      // Idle: gentle breathing sway — NOT spinning
      // Decay smoothed pointer back to center
      smoothRef.current.x *= 0.97;
      smoothRef.current.y *= 0.97;

      groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.08 + smoothRef.current.x * 0.2;
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.04 + -smoothRef.current.y * 0.1;
    }
  });

  const handlePointerMove = useCallback((e: THREE.Event & { uv?: THREE.Vector2; point?: THREE.Vector3 }) => {
    // Use NDC from the Three.js event — already in canvas-local coords
    const threeEvent = e as any;
    if (threeEvent.pointer) {
      pointerRef.current.x = threeEvent.pointer.x;
      pointerRef.current.y = threeEvent.pointer.y;
    }
  }, []);

  return (
    <group
      ref={groupRef}
      scale={1.6}
      position={[0, -0.1, 0]}
      onPointerMove={handlePointerMove}
    >
      <primitive object={scene} />
    </group>
  );
}

export default function LogoModel() {
  const [hovered, setHovered] = useState(false);

  return (
    <Canvas
      camera={{ position: [0, 0.2, 4.5], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent", cursor: hovered ? "grab" : "default" }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Suspense fallback={null}>
        {/* Soft ambient — avoids harsh shadows */}
        <ambientLight intensity={0.6} />

        {/* Key light — top-right, warm white */}
        <directionalLight
          position={[4, 4, 5]}
          intensity={0.8}
          color="#f5f5f5"
        />

        {/* Neon fill — left side, brand green accent */}
        <pointLight
          position={[-3, 1, 3]}
          intensity={0.5}
          color="#34d399"
          distance={12}
        />

        {/* Blue rim — subtle depth on the other side */}
        <pointLight
          position={[3, -1, 2]}
          intensity={0.25}
          color="#60a5fa"
          distance={10}
        />

        {/* Subtle bottom fill to avoid black underside */}
        <pointLight
          position={[0, -3, 2]}
          intensity={0.15}
          color="#34d399"
          distance={8}
        />

        <Float
          speed={2}
          rotationIntensity={0}
          floatIntensity={0.3}
          floatingRange={[-0.08, 0.08]}
        >
          <Model hovered={hovered} />
        </Float>

        {/* Contact shadow for grounding */}
        <ContactShadows
          position={[0, -1.5, 0]}
          opacity={0.15}
          scale={6}
          blur={2.5}
          far={3}
          color="#34d399"
        />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload("/models/core.glb");
