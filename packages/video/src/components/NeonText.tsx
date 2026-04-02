import React from "react";

type NeonTextProps = {
  children: React.ReactNode;
  size?: number;
  glow?: boolean;
  style?: React.CSSProperties;
};

export const NeonText = ({ children, size = 48, glow = true, style }: NeonTextProps) => {
  return (
    <span
      style={{
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        fontSize: size,
        fontWeight: 700,
        color: "#4ade80",
        textShadow: glow
          ? "0 0 20px rgba(74, 222, 128, 0.8), 0 0 60px rgba(74, 222, 128, 0.4), 0 0 100px rgba(74, 222, 128, 0.2)"
          : "none",
        letterSpacing: "-0.02em",
        ...style,
      }}
    >
      {children}
    </span>
  );
};
