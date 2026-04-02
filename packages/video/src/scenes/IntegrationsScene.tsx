import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { NeonText } from "../components/NeonText";
import { SceneLabel } from "../components/SceneLabel";

const INTEGRATIONS = [
  { name: "Memory", icon: "🧠", color: "#8b5cf6" },
  { name: "Web Search", icon: "🌐", color: "#3b82f6" },
  { name: "Email", icon: "✉️", color: "#ef4444" },
  { name: "Slack", icon: "💬", color: "#f59e0b" },
  { name: "Google Calendar", icon: "📅", color: "#4ade80" },
  { name: "Google Drive", icon: "📁", color: "#f59e0b" },
  { name: "Google Sheets", icon: "📊", color: "#22c55e" },
  { name: "Gmail", icon: "📬", color: "#ef4444" },
  { name: "Notion", icon: "📓", color: "#f4f4f5" },
  { name: "Webhooks", icon: "🔗", color: "#06b6d4" },
  { name: "Custom APIs", icon: "⚙️", color: "#71717a" },
  { name: "RAG / Docs", icon: "📄", color: "#a78bfa" },
  { name: "Tasks", icon: "☑️", color: "#4ade80" },
  { name: "Notes", icon: "📝", color: "#fbbf24" },
  { name: "Automations", icon: "⚡", color: "#f59e0b" },
  { name: "Schedules", icon: "⏰", color: "#3b82f6" },
  { name: "Image Gen", icon: "🎨", color: "#ec4899" },
  { name: "Agent Messaging", icon: "🤖", color: "#4ade80" },
];

const IntegrationTile = ({
  integration,
  delay,
  frame,
  fps,
}: {
  integration: typeof INTEGRATIONS[0];
  delay: number;
  frame: number;
  fps: number;
}) => {
  const s = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 200 } });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const scale = interpolate(s, [0, 1], [0.6, 1]);

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "20px 16px",
        borderRadius: 16,
        background: "#18181b",
        border: `1px solid ${integration.color}30`,
        width: 130,
        boxShadow: `0 0 24px ${integration.color}12`,
        cursor: "default",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: `${integration.color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          boxShadow: `0 0 16px ${integration.color}30`,
        }}
      >
        {integration.icon}
      </div>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 500,
          color: "#a1a1aa",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {integration.name}
      </span>
    </div>
  );
};

export const IntegrationsScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [0.4 * fps, 0.9 * fps], [0, 1], { extrapolateRight: "clamp" });

  // Counter animation — 0 to 18+
  const countProgress = interpolate(frame, [0.5 * fps, 4 * fps], [0, 1], { extrapolateRight: "clamp" });
  const count = Math.floor(countProgress * 18);

  return (
    <AbsoluteFill style={{ background: "#09090b" }}>
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(74,222,128,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 80px",
          gap: 20,
        }}
      >
        {/* Title */}
        <div style={{ opacity: titleOpacity, textAlign: "center" }}>
          <NeonText size={48}>
            {count}+ integrations
          </NeonText>
        </div>

        <div style={{ opacity: subtitleOpacity, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 20,
              color: "#71717a",
              margin: 0,
            }}
          >
            Connect to everything your team already uses
          </p>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "center",
            maxWidth: 1200,
          }}
        >
          {INTEGRATIONS.map((integration, i) => (
            <IntegrationTile
              key={integration.name}
              integration={integration}
              delay={Math.round((0.5 + i * 0.08) * fps)}
              frame={frame}
              fps={fps}
            />
          ))}
        </div>
      </div>
      <SceneLabel text="Integrations" />
    </AbsoluteFill>
  );
};
