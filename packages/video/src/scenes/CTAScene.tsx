import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { NeonText } from "../components/NeonText";

const PARTICLE_COUNT = 40;
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: (i * 137.508) % 100,
  y: (i * 73.2) % 100,
  size: 1 + (i % 3),
  opacity: 0.05 + (i % 5) * 0.06,
  speed: 0.2 + (i % 4) * 0.08,
}));

export const CTAScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo enters first
  const logoS = spring({ frame, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoS, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoS, [0, 1], [0, 1]);

  // Name
  const nameS = spring({ frame: frame - Math.round(0.4 * fps), fps, config: { damping: 200 } });
  const nameOpacity = interpolate(nameS, [0, 1], [0, 1]);
  const nameY = interpolate(nameS, [0, 1], [20, 0]);

  // Tagline
  const tagS = spring({ frame: frame - Math.round(0.9 * fps), fps, config: { damping: 200 } });
  const tagOpacity = interpolate(tagS, [0, 1], [0, 1]);

  // URL
  const urlOpacity = interpolate(frame, [Math.round(1.8 * fps), Math.round(2.4 * fps)], [0, 1], { extrapolateRight: "clamp" });

  // CTA button
  const ctaS = spring({ frame: frame - Math.round(2 * fps), fps, config: { damping: 20, stiffness: 200 } });
  const ctaScale = interpolate(ctaS, [0, 1], [0.8, 1]);
  const ctaOpacity = interpolate(ctaS, [0, 1], [0, 1]);

  // Neon glow pulse
  const glow = 0.7 + 0.3 * Math.sin(frame * 0.08);

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 50%, #0a1a0a 0%, #030305 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      {/* Particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(p.x + frame * p.speed * 0.015) % 100}%`,
            top: `${(p.y + Math.sin(frame * 0.012 + i) * 0.4) % 100}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "#4ade80",
            opacity: p.opacity,
          }}
        />
      ))}

      {/* Logo mark */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          width: 100,
          height: 100,
          borderRadius: 26,
          background: "rgba(74,222,128,0.08)",
          border: `1px solid rgba(74,222,128,${0.3 * glow + 0.1})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 ${60 * glow}px rgba(74,222,128,0.25)`,
          fontSize: 50,
        }}
      >
        ✦
      </div>

      {/* Brand name */}
      <div style={{ opacity: nameOpacity, transform: `translateY(${nameY}px)` }}>
        <NeonText
          size={80}
          style={{
            textShadow: `0 0 ${40 * glow}px rgba(74,222,128,0.9), 0 0 100px rgba(74,222,128,0.3)`,
          }}
        >
          HiGantic
        </NeonText>
      </div>

      {/* Tagline */}
      <div style={{ opacity: tagOpacity, textAlign: "center" }}>
        <p
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: 28,
            fontWeight: 300,
            color: "#a1a1aa",
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          Not another chatbot.{" "}
          <span style={{ color: "#4ade80", fontWeight: 500 }}>A workspace that thinks.</span>
        </p>
      </div>

      {/* Divider */}
      <div
        style={{
          width: interpolate(frame, [0.5 * fps, 2 * fps], [0, 300], { extrapolateRight: "clamp" }),
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent)",
        }}
      />

      {/* CTA button */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          padding: "18px 48px",
          borderRadius: 16,
          background: "linear-gradient(135deg, #4ade80, #22c55e)",
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
          fontSize: 20,
          fontWeight: 700,
          color: "#000",
          letterSpacing: "-0.01em",
          boxShadow: `0 0 ${40 * glow}px rgba(74,222,128,0.4), 0 8px 32px rgba(0,0,0,0.3)`,
        }}
      >
        Build your first agent today →
      </div>

      {/* URL hint */}
      <div style={{ opacity: urlOpacity }}>
        <p
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: 15,
            color: "#3f3f46",
            margin: 0,
            letterSpacing: "0.04em",
          }}
        >
          higantic.com
        </p>
      </div>
    </AbsoluteFill>
  );
};
