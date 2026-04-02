import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence } from "remotion";
import { NeonText } from "../components/NeonText";
import { UICard } from "../components/UICard";
import { SceneLabel } from "../components/SceneLabel";

const TEMPLATES = [
  { icon: "🎧", name: "Customer Support", color: "#3b82f6" },
  { icon: "🔬", name: "Research Assistant", color: "#8b5cf6" },
  { icon: "📋", name: "Project Manager", color: "#f59e0b" },
  { icon: "✍️", name: "Writing Assistant", color: "#ec4899" },
  { icon: "📊", name: "Data Analyst", color: "#06b6d4" },
];

const TOOLS = [
  { icon: "🧠", name: "Memory", enabled: true },
  { icon: "🌐", name: "Web Search", enabled: true },
  { icon: "📋", name: "Tasks", enabled: true },
  { icon: "✉️", name: "Email", enabled: false },
  { icon: "🔗", name: "Slack", enabled: true },
  { icon: "📅", name: "Calendar", enabled: false },
];

const TemplateCard = ({ template, selected, delay, frame, fps }: {
  template: typeof TEMPLATES[0]; selected: boolean; delay: number; frame: number; fps: number;
}) => {
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const y = interpolate(s, [0, 1], [20, 0]);
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        padding: "12px 16px",
        borderRadius: 14,
        background: selected ? "rgba(74,222,128,0.1)" : "#27272a",
        border: selected ? "1.5px solid rgba(74,222,128,0.5)" : "1px solid #3f3f46",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "default",
        boxShadow: selected ? "0 0 16px rgba(74,222,128,0.12)" : "none",
      }}
    >
      <span style={{ fontSize: 20 }}>{template.icon}</span>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
          fontWeight: 500,
          color: selected ? "#4ade80" : "#a1a1aa",
        }}
      >
        {template.name}
      </span>
      {selected && (
        <span style={{ marginLeft: "auto", fontSize: 14, color: "#4ade80" }}>✓</span>
      )}
    </div>
  );
};

const ToolToggle = ({ tool, delay, frame, fps }: {
  tool: typeof TOOLS[0]; delay: number; frame: number; fps: number;
}) => {
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  return (
    <div
      style={{
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderRadius: 12,
        background: "#1c1c1f",
        border: "1px solid #27272a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>{tool.icon}</span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#d4d4d8" }}>{tool.name}</span>
      </div>
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: tool.enabled ? "#4ade80" : "#3f3f46",
          position: "relative",
          boxShadow: tool.enabled ? "0 0 8px rgba(74,222,128,0.5)" : "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: tool.enabled ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "none",
          }}
        />
      </div>
    </div>
  );
};

export const CreatorScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title
  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame, fps, config: { damping: 200 } }), [0, 1], [30, 0]);

  // Which template is highlighted (cycles)
  const selectedIdx = Math.min(2, Math.floor(frame / (2.5 * fps)));

  // Step indicator
  const step = frame < 3 * fps ? 1 : frame < 7 * fps ? 2 : 3;

  return (
    <AbsoluteFill style={{ background: "#09090b" }}>
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
          gap: 32,
        }}
      >
        {/* Title */}
        <div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)`, textAlign: "center" }}>
          <NeonText size={48}>Build your agent in 60 seconds</NeonText>
        </div>

        {/* Step pills */}
        <div style={{ display: "flex", gap: 12 }}>
          {["Choose template", "Enable tools", "Launch"].map((s, i) => {
            const active = step === i + 1;
            const done = step > i + 1;
            return (
              <div
                key={i}
                style={{
                  padding: "6px 16px",
                  borderRadius: 100,
                  background: done ? "rgba(74,222,128,0.15)" : active ? "rgba(74,222,128,0.1)" : "#18181b",
                  border: `1px solid ${done || active ? "rgba(74,222,128,0.4)" : "#27272a"}`,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: done || active ? "#4ade80" : "#52525b",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: done || active ? "#4ade80" : "#27272a",
                    color: done || active ? "#000" : "#52525b",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                {s}
              </div>
            );
          })}
        </div>

        {/* Two-panel layout */}
        <div style={{ display: "flex", gap: 24, width: "100%", maxWidth: 1200 }}>
          {/* Left: Templates */}
          <UICard style={{ flex: 1, padding: 24 }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 16,
              }}
            >
              Choose a template
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TEMPLATES.map((t, i) => (
                <TemplateCard
                  key={t.name}
                  template={t}
                  selected={i === selectedIdx}
                  delay={Math.round((0.3 + i * 0.12) * fps)}
                  frame={frame}
                  fps={fps}
                />
              ))}
            </div>
          </UICard>

          {/* Right: Tool toggles */}
          <UICard style={{ flex: 1, padding: 24 }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 16,
              }}
            >
              Enable integrations
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TOOLS.map((t, i) => (
                <ToolToggle
                  key={t.name}
                  tool={t}
                  delay={Math.round((0.5 + i * 0.15) * fps)}
                  frame={frame}
                  fps={fps}
                />
              ))}
            </div>
          </UICard>

          {/* Right-most: Preview card */}
          <Sequence from={Math.round(5 * fps)} premountFor={fps}>
            <UICard
              glow
              style={{ width: 280, padding: 28, display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background: "linear-gradient(135deg, #4ade80, #16a34a)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  boxShadow: "0 0 24px rgba(74,222,128,0.4)",
                }}
              >
                📋
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: "#f4f4f5" }}>
                  Project Manager
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#71717a", marginTop: 4 }}>
                  5 tools enabled
                </div>
              </div>
              <div
                style={{
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                  textAlign: "center",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#000",
                  boxShadow: "0 0 20px rgba(74,222,128,0.4)",
                }}
              >
                Launch Agent →
              </div>
            </UICard>
          </Sequence>
        </div>
      </div>
      <SceneLabel text="Agent Creator" />
    </AbsoluteFill>
  );
};
