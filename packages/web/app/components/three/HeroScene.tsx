/**
 * HeroScene — Minimal Three.js ambient particle background.
 * Kept intentionally sparse — the integration network overlay
 * (rendered as HTML/SVG) carries the visual storytelling.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Float, ContactShadows } from "@react-three/drei";
import { Suspense, useRef, useMemo, useEffect } from "react";
import * as THREE from "three";

/* ── Constants ─────────────────────────────────────────────────────── */
const PARTICLE_COUNT = 30;
const BOUNDS = { x: 14, y: 8, z: 4 };

/* ── Minimal ambient particles ─────────────────────────────────────── */
function AmbientParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * BOUNDS.x * 2;
      positions[i3 + 1] = (Math.random() - 0.5) * BOUNDS.y * 2;
      positions[i3 + 2] = (Math.random() - 0.5) * BOUNDS.z - 2;
      velocities[i3] = (Math.random() - 0.5) * 0.004;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.003;
      velocities[i3 + 2] = 0;
      scales[i] = 0.015 + Math.random() * 0.025;
    }
    return { positions, velocities, scales };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      data.positions[i3] += data.velocities[i3] + Math.sin(t * 0.2 + i) * 0.0005;
      data.positions[i3 + 1] += data.velocities[i3 + 1] + Math.cos(t * 0.15 + i) * 0.0005;

      // Wrap boundaries
      if (Math.abs(data.positions[i3]) > BOUNDS.x) data.positions[i3] *= -0.99;
      if (Math.abs(data.positions[i3 + 1]) > BOUNDS.y) data.positions[i3 + 1] *= -0.99;

      const pulse = data.scales[i] * (1 + Math.sin(t * 1.2 + i * 0.7) * 0.25);
      dummy.position.set(data.positions[i3], data.positions[i3 + 1], data.positions[i3 + 2]);
      dummy.scale.setScalar(pulse);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#34d399" transparent opacity={0.25} />
    </instancedMesh>
  );
}

/* ── Logo Model ────────────────────────────────────────────────────── */
function LogoModelInner() {
  const { scene } = useGLTF("/models/core.glb");
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Zone: right 60% of screen, top 100vh only
      const xRatio = e.clientX / window.innerWidth;
      const inZone = xRatio > 0.4 && e.clientY < window.innerHeight;

      if (inZone) {
        targetRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        targetRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        activeRef.current = true;
      } else {
        // Outside zone — drift back to center
        activeRef.current = false;
        targetRef.current.x = 0;
        targetRef.current.y = 0;
      }
    };
    const handleLeave = () => {
      activeRef.current = false;
      targetRef.current.x = 0;
      targetRef.current.y = 0;
    };
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Fast, smooth lerp toward mouse target (or back to center)
    const speed = activeRef.current ? 0.12 : 0.06;
    currentRef.current.x += (targetRef.current.x - currentRef.current.x) * speed;
    currentRef.current.y += (targetRef.current.y - currentRef.current.y) * speed;

    // Strong tilt — up to ~25° on each axis, plus a gentle idle sway
    const idleY = Math.sin(t * 0.4) * 0.06;
    const idleX = Math.sin(t * 0.3) * 0.03;

    groupRef.current.rotation.y = currentRef.current.x * 0.45 + idleY;
    groupRef.current.rotation.x = -currentRef.current.y * 0.3 + idleX;
  });

  return (
    <group ref={groupRef} scale={2.6} position={[3.2, 0.2, 0]}>
      <primitive object={scene} />
    </group>
  );
}

/* ── Main Scene Export ─────────────────────────────────────────────── */
export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "transparent",
        pointerEvents: "none",
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} color="#f5f5f5" />
        <pointLight position={[-4, 2, 4]} intensity={0.4} color="#34d399" distance={15} />
        <pointLight position={[4, -2, 3]} intensity={0.2} color="#60a5fa" distance={12} />

        <AmbientParticles />

        <Float speed={2} rotationIntensity={0} floatIntensity={0.3} floatingRange={[-0.08, 0.08]}>
          <LogoModelInner />
        </Float>

        <ContactShadows position={[3.2, -2.5, 0]} opacity={0.12} scale={10} blur={3} far={5} color="#34d399" />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload("/models/core.glb");
