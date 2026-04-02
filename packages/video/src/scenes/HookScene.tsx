import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { NeonText } from "../components/NeonText";

// Particle background
const PARTICLE_COUNT = 60;
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: (i * 137.508) % 100,
  y: (i * 73.2) % 100,
  size: 1 + (i % 3),
  opacity: 0.1 + (i % 5) * 0.08,
  speed: 0.3 + (i % 4) * 0.1,
}));

const Particles = ({ frame }: { frame: number }) => (
  <>
    {particles.map((p, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${(p.x + (frame * p.speed * 0.02)) % 100}%`,
          top: `${(p.y + Math.sin(frame * 0.01 + i) * 0.5) % 100}%`,
          width: p.size,
          height: p.size,
          borderRadius: "50%",
          background: "#4ade80",
          opacity: p.opacity,
          boxShadow: "0 0 4px rgba(74,222,128,0.6)",
        }}
      />
    ))}
  </>
);

// Typewriter for tagline
const Typewriter = ({ text, frame, startFrame, fps }: { text: string; frame: number; startFrame: number; fps: number }) => {
  const charsPerSecond = 30;
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.floor((elapsed / fps) * charsPerSecond);
  const visible = text.slice(0, charCount);
  const showCursor = charCount < text.length || Math.floor(frame / 30) % 2 === 0;
  return (
    <span
      style={{
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        fontSize: 32,
        fontWeight: 400,
        color: "#a1a1aa",
        letterSpacing: "0.01em",
      }}
    >
      {visible}
      {showCursor && (
        <span style={{ color: "#4ade80", marginLeft: 2, opacity: showCursor ? 1 : 0 }}>|</span>
      )}
    </span>
  );
};

export const HookScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo scale-in
  const logoScale = spring({ frame, fps, config: { damping: 200 } });
  const logoOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });

  // "HiGantic" word reveal — letter by letter opacity stagger
  const wordOpacity = interpolate(frame, [0.5 * fps, 1.2 * fps], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const wordScale = interpolate(
    spring({ frame: frame - Math.round(0.5 * fps), fps, config: { damping: 200 } }),
    [0, 1], [0.85, 1]
  );

  // Neon glow pulse
  const glowPulse = 0.7 + 0.3 * Math.sin(frame * 0.08);

  // Tagline starts after wordReveal settles
  const taglineStart = Math.round(2 * fps);

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 40%, #0a1a0a 0%, #09090b 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <Particles frame={frame} />

      {/* Horizontal rule above */}
      <div
        style={{
          width: interpolate(frame, [0.3 * fps, 1.5 * fps], [0, 400], { extrapolateRight: "clamp" }),
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent)",
          marginBottom: 8,
        }}
      />

      {/* Logo mark */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "rgba(74,222,128,0.08)",
          border: "1px solid rgba(74,222,128,0.3)",
          boxShadow: `0 0 ${40 * glowPulse}px rgba(74,222,128,0.3)`,
          fontSize: 40,
        }}
      >
        ✦
      </div>

      {/* Brand name */}
      <div
        style={{
          opacity: wordOpacity,
          transform: `scale(${wordScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <NeonText size={96} glow style={{ textShadow: `0 0 ${30 * glowPulse}px rgba(74,222,128,0.9), 0 0 80px rgba(74,222,128,0.4)` }}>
          HiGantic
        </NeonText>
      </div>

      {/* Tagline typewriter */}
      <Typewriter
        text="Not another chatbot. A workspace that thinks."
        frame={frame}
        startFrame={taglineStart}
        fps={fps}
      />

      {/* Horizontal rule below */}
      <div
        style={{
          width: interpolate(frame, [0.3 * fps, 1.5 * fps], [0, 400], { extrapolateRight: "clamp" }),
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent)",
          marginTop: 8,
        }}
      />
    </AbsoluteFill>
  );
};
