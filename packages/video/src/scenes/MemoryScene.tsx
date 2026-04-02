import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence } from "remotion";
import { ChatBubble } from "../components/ChatBubble";
import { UICard } from "../components/UICard";
import { SceneLabel } from "../components/SceneLabel";
import { NeonText } from "../components/NeonText";

const CONVO_1 = [
  { role: "user" as const, text: "I'm working on the Alpha Launch, targeting Q2 2025.", startFrame: 0.5 },
  { role: "agent" as const, text: "Got it — I'll remember that. Anything else to note?", startFrame: 1.5 },
  { role: "user" as const, text: "My preferred stack is TypeScript + Convex.", startFrame: 2.5 },
  { role: "agent" as const, text: "Saved to memory.", startFrame: 3.2 },
];

const CONVO_2 = [
  { role: "user" as const, text: "Hey, what project was I working on?", startFrame: 0.3 },
  { role: "agent" as const, text: "The Alpha Launch — Q2 2025 deadline, TypeScript + Convex stack. Want me to check the task board?", startFrame: 1.2 },
];

const MemoryChip = ({ text, delay, frame, fps }: { text: string; delay: number; frame: number; fps: number }) => {
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const scale = interpolate(s, [0, 1], [0.8, 1]);
  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        padding: "6px 12px",
        borderRadius: 8,
        background: "rgba(74,222,128,0.08)",
        border: "1px solid rgba(74,222,128,0.25)",
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        color: "#4ade80",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 10 }}>◆</span>
      {text}
    </div>
  );
};

export const MemoryScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase: 0-4s = first convo, 4-10s = second convo
  const phase2Start = Math.round(4.5 * fps);

  const titleOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: "clamp" });

  // "New conversation" badge
  const badgeOpacity = interpolate(frame, [phase2Start - 10, phase2Start + 10], [0, 1], { extrapolateRight: "clamp" });
  const badgeScale = spring({ frame: frame - (phase2Start - 10), fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#09090b" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 80px",
          gap: 24,
        }}
      >
        {/* Title */}
        <div style={{ opacity: titleOpacity, textAlign: "center" }}>
          <NeonText size={48}>Agents that remember everything</NeonText>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, color: "#71717a", marginTop: 8 }}>
            Persistent memory across every conversation
          </p>
        </div>

        <div style={{ display: "flex", gap: 40, width: "100%", maxWidth: 1100, alignItems: "flex-start" }}>
          {/* Conversation 1 */}
          <UICard style={{ flex: 1, padding: 24 }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: "#52525b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#52525b" }} />
              Conversation — Monday
            </div>
            {CONVO_1.map((msg, i) => {
              const msgFrame = Math.round(msg.startFrame * fps);
              const msgOpacity = interpolate(frame, [msgFrame, msgFrame + 15], [0, 1], { extrapolateRight: "clamp" });
              const msgY = interpolate(frame, [msgFrame, msgFrame + 20], [16, 0], { extrapolateRight: "clamp" });
              return (
                <ChatBubble
                  key={i}
                  role={msg.role}
                  text={msg.text}
                  opacity={msgOpacity}
                  translateY={msgY}
                />
              );
            })}
          </UICard>

          {/* Memory bank */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 48 }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: "#4ade80",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                textAlign: "center",
                textShadow: "0 0 8px rgba(74,222,128,0.5)",
              }}
            >
              Memory Bank
            </div>
            <MemoryChip text="Alpha Launch — Q2 2025" delay={Math.round(1.8 * fps)} frame={frame} fps={fps} />
            <MemoryChip text="Stack: TypeScript + Convex" delay={Math.round(3 * fps)} frame={frame} fps={fps} />
            <MemoryChip text="Prefers dark mode tools" delay={Math.round(3.5 * fps)} frame={frame} fps={fps} />
            {/* Arrow */}
            <div
              style={{
                opacity: interpolate(frame, [Math.round(3.8 * fps), Math.round(4.3 * fps)], [0, 1], { extrapolateRight: "clamp" }),
                textAlign: "center",
                fontSize: 24,
                color: "#4ade80",
                textShadow: "0 0 12px rgba(74,222,128,0.6)",
              }}
            >
              ↓
            </div>
          </div>

          {/* Conversation 2 */}
          <UICard glow style={{ flex: 1, padding: 24 }}>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: "#4ade80",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px rgba(74,222,128,0.8)" }} />
              New Conversation — Friday
            </div>

            {/* "New conversation" badge */}
            <div
              style={{
                opacity: badgeOpacity,
                transform: `scale(${badgeScale})`,
                padding: "6px 14px",
                borderRadius: 100,
                background: "rgba(74,222,128,0.1)",
                border: "1px solid rgba(74,222,128,0.3)",
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: "#4ade80",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              Fresh session — agent still remembers
            </div>

            {CONVO_2.map((msg, i) => {
              const msgFrame = phase2Start + Math.round(msg.startFrame * fps);
              const msgOpacity = interpolate(frame, [msgFrame, msgFrame + 15], [0, 1], { extrapolateRight: "clamp" });
              const msgY = interpolate(frame, [msgFrame, msgFrame + 20], [16, 0], { extrapolateRight: "clamp" });
              return (
                <ChatBubble
                  key={i}
                  role={msg.role}
                  text={msg.text}
                  opacity={msgOpacity}
                  translateY={msgY}
                />
              );
            })}
          </UICard>
        </div>
      </div>
      <SceneLabel text="Persistent Memory" />
    </AbsoluteFill>
  );
};
