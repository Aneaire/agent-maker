import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type SceneLabelProps = {
  text: string;
  startFrame?: number;
};

export const SceneLabel = ({ text, startFrame = 0 }: SceneLabelProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame - startFrame, [0, 0.5 * fps], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: 80,
        opacity,
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        fontSize: 14,
        fontWeight: 500,
        color: "#4ade80",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
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
          background: "#4ade80",
          boxShadow: "0 0 8px rgba(74,222,128,0.8)",
        }}
      />
      {text}
    </div>
  );
};
