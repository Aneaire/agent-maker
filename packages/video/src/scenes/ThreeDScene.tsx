import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { NeonText } from "../components/NeonText";
import { SceneLabel } from "../components/SceneLabel";

// Orbit node: loads a GLB and positions it in orbit
const OrbitNode = ({
  glbPath,
  angle,
  radius,
  frame,
  fps,
  enterDelay,
  orbitSpeed,
}: {
  glbPath: string;
  angle: number;
  radius: number;
  frame: number;
  fps: number;
  enterDelay: number;
  orbitSpeed: number;
}) => {
  const { scene } = useGLTF(glbPath);
  const cloned = scene.clone();

  const enterProgress = Math.min(1, Math.max(0, (frame - enterDelay) / (0.8 * fps)));
  const currentAngle = angle + (frame * orbitSpeed);
  const x = Math.cos(currentAngle) * radius * enterProgress;
  const z = Math.sin(currentAngle) * radius * enterProgress;
  const scale = enterProgress * 0.4;

  return (
    <primitive
      object={cloned}
      position={[x, Math.sin(currentAngle * 0.5) * 0.3, z]}
      scale={[scale, scale, scale]}
      rotation={[0, currentAngle + Math.PI, 0]}
    />
  );
};

// Core node in center
const CoreNode = ({ frame, fps }: { frame: number; fps: number }) => {
  const { scene } = useGLTF("/models/optimized/core.glb");
  const cloned = scene.clone();
  const enter = Math.min(1, Math.max(0, frame / (0.6 * fps)));
  const pulse = 0.6 + 0.04 * Math.sin(frame * 0.05);
  const scale = enter * pulse;
  return (
    <primitive
      object={cloned}
      position={[0, 0, 0]}
      scale={[scale, scale, scale]}
      rotation={[0, frame * 0.005, 0]}
    />
  );
};

const ORBIT_NODES = [
  { glb: "/models/optimized/brain-node.glb", angle: 0, radius: 3, orbitSpeed: 0.008, enterDelay: 0.3 },
  { glb: "/models/optimized/globe-node.glb", angle: (Math.PI * 2) / 6, radius: 3, orbitSpeed: 0.008, enterDelay: 0.5 },
  { glb: "/models/optimized/email-node.glb", angle: (Math.PI * 4) / 6, radius: 3, orbitSpeed: 0.008, enterDelay: 0.7 },
  { glb: "/models/optimized/api-node.glb", angle: (Math.PI * 6) / 6, radius: 3, orbitSpeed: 0.008, enterDelay: 0.9 },
  { glb: "/models/optimized/automation-node.glb", angle: (Math.PI * 8) / 6, radius: 3, orbitSpeed: 0.008, enterDelay: 1.1 },
  { glb: "/models/optimized/pages-node.glb", angle: (Math.PI * 10) / 6, radius: 3, orbitSpeed: 0.008, enterDelay: 1.3 },
];

const ThreeScene = ({ frame, fps }: { frame: number; fps: number }) => {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[0, 0, 2]} intensity={2} color="#4ade80" distance={8} />
      <pointLight position={[3, 3, 3]} intensity={0.8} color="#22c55e" distance={10} />

      <CoreNode frame={frame} fps={fps} />

      {ORBIT_NODES.map((node, i) => (
        <OrbitNode
          key={i}
          glbPath={node.glb}
          angle={node.angle}
          radius={node.radius}
          frame={frame}
          fps={fps}
          enterDelay={Math.round(node.enterDelay * fps)}
          orbitSpeed={node.orbitSpeed}
        />
      ))}
    </>
  );
};

export const ThreeDScene = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const titleOpacity = interpolate(frame, [Math.round(1.5 * fps), Math.round(2.5 * fps)], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Fade in the whole scene
  const sceneOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#030305", opacity: sceneOpacity }}>
      {/* Dark vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(3,3,5,0.8) 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* 3D Canvas */}
      <ThreeCanvas width={width} height={height}>
        <ThreeScene frame={frame} fps={fps} />
      </ThreeCanvas>

      {/* Text overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          zIndex: 2,
        }}
      >
        <NeonText size={52}>One agent. Infinite possibilities.</NeonText>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 20,
            color: "#71717a",
            marginTop: 12,
          }}
        >
          Memory · Tools · Automations · Workspace · Integrations
        </p>
      </div>

      <SceneLabel text="HiGantic Platform" />
    </AbsoluteFill>
  );
};
