import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const OldChatPanel = ({ opacity, x }: { opacity: number; x: number }) => (
  <div
    style={{
      width: 480,
      height: 520,
      borderRadius: 16,
      background: "#ffffff",
      border: "1px solid #e5e5e5",
      opacity,
      transform: `translateX(${x}px)`,
      padding: 24,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    }}
  >
    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#d1d5db" }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", fontFamily: "sans-serif" }}>Generic AI Chat</div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "sans-serif" }}>● Online</div>
      </div>
    </div>
    {/* Messages */}
    {[
      { role: "user", text: "What was the project we discussed?" },
      { role: "bot", text: "I don't have memory of previous conversations. Could you remind me?" },
      { role: "user", text: "Can you create a task for it?" },
      { role: "bot", text: "I can't create tasks or take actions. I can only chat." },
    ].map((msg, i) => (
      <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
        <div
          style={{
            maxWidth: "80%",
            padding: "8px 14px",
            borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: msg.role === "user" ? "#3b82f6" : "#f3f4f6",
            color: msg.role === "user" ? "#ffffff" : "#374151",
            fontSize: 13,
            fontFamily: "sans-serif",
            lineHeight: 1.4,
          }}
        >
          {msg.text}
        </div>
      </div>
    ))}
    {/* Sad badge */}
    <div style={{ marginTop: "auto", padding: "8px 12px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
      <span style={{ fontSize: 12, color: "#ef4444", fontFamily: "sans-serif" }}>✗ No memory &nbsp;✗ No actions &nbsp;✗ No workspace</span>
    </div>
  </div>
);

const HiGanticPanel = ({ opacity, x }: { opacity: number; x: number }) => (
  <div
    style={{
      width: 480,
      height: 520,
      borderRadius: 20,
      background: "#18181b",
      border: "1px solid rgba(74,222,128,0.3)",
      opacity,
      transform: `translateX(${x}px)`,
      padding: 24,
      display: "flex",
      flexDirection: "column",
      gap: 14,
      boxShadow: "0 0 60px rgba(74,222,128,0.12), 0 8px 32px rgba(0,0,0,0.5)",
    }}
  >
    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid #27272a" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #4ade80, #22c55e)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          boxShadow: "0 0 12px rgba(74,222,128,0.5)",
        }}
      >
        ✦
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f4f4f5", fontFamily: "'Inter', sans-serif" }}>HiGantic Agent</div>
        <div style={{ fontSize: 11, color: "#4ade80", fontFamily: "'Inter', sans-serif" }}>● Thinking...</div>
      </div>
    </div>
    {/* Messages */}
    {[
      { role: "user", text: "What was the project we discussed?" },
      { role: "agent", text: "The Alpha Launch project — you set a deadline for Q2. Want me to update the task board?" },
      { role: "user", text: "Yes, and remind me Monday." },
      { role: "agent", text: "Done. Task updated, timer set for Monday 9am. I also drafted a brief in your Notes page." },
    ].map((msg, i) => (
      <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
        <div
          style={{
            maxWidth: "80%",
            padding: "10px 16px",
            borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            background: msg.role === "user" ? "#27272a" : "rgba(74,222,128,0.07)",
            border: msg.role === "agent" ? "1px solid rgba(74,222,128,0.2)" : "1px solid #3f3f46",
            color: "#f4f4f5",
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1.5,
          }}
        >
          {msg.text}
        </div>
      </div>
    ))}
    {/* Happy badge */}
    <div
      style={{
        marginTop: "auto",
        padding: "8px 14px",
        background: "rgba(74,222,128,0.08)",
        borderRadius: 10,
        border: "1px solid rgba(74,222,128,0.25)",
      }}
    >
      <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "'Inter', sans-serif" }}>
        ✓ Persistent memory &nbsp;✓ Takes action &nbsp;✓ Full workspace
      </span>
    </div>
  </div>
);

export const ProblemScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftIn = spring({ frame, fps, config: { damping: 200 } });
  const rightIn = spring({ frame: frame - Math.round(0.5 * fps), fps, config: { damping: 200 } });

  const leftX = interpolate(leftIn, [0, 1], [-80, 0]);
  const rightX = interpolate(rightIn, [0, 1], [80, 0]);
  const leftOpacity = interpolate(leftIn, [0, 1], [0, 1]);
  const rightOpacity = interpolate(rightIn, [0, 1], [0, 1]);

  // vs label pulse
  const vsPulse = 1 + 0.05 * Math.sin(frame * 0.1);

  // Header line
  const headerOpacity = interpolate(frame, [0.2 * fps, 0.8 * fps], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "#09090b",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {/* Header */}
      <div style={{ opacity: headerOpacity, textAlign: "center" }}>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            fontWeight: 500,
            color: "#71717a",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Most AI tools are stuck in the past
        </p>
      </div>

      {/* Side by side */}
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <div
            style={{
              opacity: leftOpacity,
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Generic chatbot
          </div>
          <OldChatPanel opacity={leftOpacity} x={leftX} />
        </div>

        {/* VS divider */}
        <div
          style={{
            transform: `scale(${vsPulse})`,
            fontFamily: "'Inter', sans-serif",
            fontSize: 28,
            fontWeight: 900,
            color: "#3f3f46",
            letterSpacing: "-0.04em",
          }}
        >
          vs
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <div
            style={{
              opacity: rightOpacity,
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#4ade80",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textShadow: "0 0 12px rgba(74,222,128,0.6)",
            }}
          >
            HiGantic
          </div>
          <HiGanticPanel opacity={rightOpacity} x={rightX} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
