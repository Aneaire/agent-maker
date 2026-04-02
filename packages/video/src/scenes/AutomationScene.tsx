import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { NeonText } from "../components/NeonText";
import { SceneLabel } from "../components/SceneLabel";

type Step = {
  id: string;
  icon: string;
  label: string;
  sublabel: string;
  color: string;
  x: number;
  y: number;
};

const STEPS: Step[] = [
  { id: "trigger", icon: "⚡", label: "Trigger", sublabel: "task.created", color: "#8b5cf6", x: 100, y: 240 },
  { id: "filter",  icon: "⚙️", label: "Filter",  sublabel: "priority = high", color: "#f59e0b", x: 380, y: 240 },
  { id: "email",   icon: "✉️", label: "Send Email", sublabel: "to: team@company.com", color: "#3b82f6", x: 660, y: 120 },
  { id: "slack",   icon: "💬", label: "Slack",   sublabel: "#dev-alerts channel", color: "#f59e0b", x: 660, y: 240 },
  { id: "note",    icon: "📝", label: "Log Note", sublabel: "Store in Notes page", color: "#4ade80", x: 660, y: 360 },
  { id: "agent",   icon: "🤖", label: "Run Agent", sublabel: "Summarize & update", color: "#ec4899", x: 940, y: 240 },
];

const CONNECTIONS: Array<[string, string]> = [
  ["trigger", "filter"],
  ["filter", "email"],
  ["filter", "slack"],
  ["filter", "note"],
  ["slack", "agent"],
];

const NODE_W = 180;
const NODE_H = 70;

const getCenter = (step: Step) => ({
  x: step.x + NODE_W / 2,
  y: step.y + NODE_H / 2,
});

const AutomationNode = ({
  step, activated, enterProgress,
}: {
  step: Step; activated: boolean; enterProgress: number;
}) => {
  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const scale = interpolate(enterProgress, [0, 1], [0.7, 1]);
  const glow = activated ? `0 0 24px ${step.color}60, 0 0 48px ${step.color}30` : `0 2px 12px rgba(0,0,0,0.4)`;

  return (
    <div
      style={{
        position: "absolute",
        left: step.x,
        top: step.y,
        width: NODE_W,
        height: NODE_H,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center",
        borderRadius: 14,
        background: activated ? `${step.color}18` : "#18181b",
        border: `1.5px solid ${activated ? step.color + "80" : "#27272a"}`,
        boxShadow: glow,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${step.color}20`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {step.icon}
      </div>
      <div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: activated ? step.color : "#a1a1aa" }}>
          {step.label}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#52525b" }}>
          {step.sublabel}
        </div>
      </div>
      {activated && (
        <div
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: step.color,
            boxShadow: `0 0 8px ${step.color}`,
          }}
        />
      )}
    </div>
  );
};

// SVG connection line that animates from 0 to 1
const ConnectionLine = ({
  from, to, progress, activated,
}: {
  from: Step; to: Step; progress: number; activated: boolean;
}) => {
  const fc = getCenter(from);
  const tc = getCenter(to);
  // Adjust to edges
  const startX = fc.x + NODE_W / 2 - 10;
  const endX = tc.x - NODE_W / 2 + 10;
  const midX = (startX + endX) / 2;
  const path = `M ${startX} ${fc.y} C ${midX} ${fc.y}, ${midX} ${tc.y}, ${endX} ${tc.y}`;
  const totalLen = 300; // approx

  return (
    <path
      d={path}
      fill="none"
      stroke={activated ? from.color : "#27272a"}
      strokeWidth={activated ? 2 : 1.5}
      strokeDasharray={totalLen}
      strokeDashoffset={totalLen * (1 - progress)}
      style={{ filter: activated ? `drop-shadow(0 0 4px ${from.color})` : "none" }}
    />
  );
};

export const AutomationScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });

  // Node enter animations — staggered
  const nodeEnter = STEPS.map((_, i) =>
    interpolate(
      spring({ frame: frame - Math.round(i * 0.2 * fps), fps, config: { damping: 200 } }),
      [0, 1], [0, 1]
    )
  );

  // "Fire" animation: trigger event at 4s, then each downstream node activates
  const fireStart = Math.round(3 * fps);
  const FIRE_DELAY = Math.round(0.6 * fps);

  const fireOrder = ["trigger", "filter", "email", "slack", "note", "agent"];
  const isActivated = (id: string) => {
    const idx = fireOrder.indexOf(id);
    if (idx === -1) return false;
    return frame >= fireStart + idx * FIRE_DELAY;
  };

  // Connection line draw progress
  const connProgress = (from: Step) => {
    const idx = fireOrder.indexOf(from.id);
    const start = fireStart + idx * FIRE_DELAY;
    return interpolate(frame, [start, start + FIRE_DELAY * 0.8], [0, 1], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    });
  };

  // "Event triggered" badge
  const badgeOpacity = interpolate(frame, [fireStart - 5, fireStart + 10], [0, 1], { extrapolateRight: "clamp" });
  const badgeY = interpolate(
    spring({ frame: frame - fireStart + 5, fps, config: { damping: 200 } }),
    [0, 1], [20, 0]
  );

  return (
    <AbsoluteFill style={{ background: "#09090b" }}>
      {/* Grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(74,222,128,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.025) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: "40px 80px",
          gap: 20,
        }}
      >
        {/* Title */}
        <div style={{ opacity: titleOpacity }}>
          <NeonText size={44}>Event-driven automations</NeonText>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, color: "#71717a", marginTop: 6 }}>
            One event triggers a cascade of actions — instantly
          </p>
        </div>

        {/* Badge */}
        <div style={{ height: 36, display: "flex", alignItems: "center" }}>
          <div
            style={{
              opacity: badgeOpacity,
              transform: `translateY(${badgeY}px)`,
              padding: "6px 16px",
              borderRadius: 100,
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.4)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              color: "#a78bfa",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#a78bfa",
                boxShadow: "0 0 6px rgba(167,139,250,0.8)",
              }}
            />
            New high-priority task created — automation firing...
          </div>
        </div>

        {/* Flow diagram */}
        <div style={{ position: "relative", flex: 1 }}>
          {/* SVG for connections */}
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
            viewBox="0 0 1200 500"
          >
            {CONNECTIONS.map(([fromId, toId], i) => {
              const fromStep = STEPS.find((s) => s.id === fromId)!;
              const toStep = STEPS.find((s) => s.id === toId)!;
              return (
                <ConnectionLine
                  key={i}
                  from={fromStep}
                  to={toStep}
                  progress={connProgress(fromStep)}
                  activated={isActivated(fromId) && isActivated(toId)}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {STEPS.map((step, i) => (
            <AutomationNode
              key={step.id}
              step={step}
              activated={isActivated(step.id)}
              enterProgress={nodeEnter[i]}
            />
          ))}
        </div>
      </div>
      <SceneLabel text="Automation Engine" />
    </AbsoluteFill>
  );
};
