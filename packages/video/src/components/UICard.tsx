import React from "react";

type UICardProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  glow?: boolean;
};

export const UICard = ({ children, style, glow = false }: UICardProps) => {
  return (
    <div
      style={{
        borderRadius: 20,
        border: glow ? "1px solid rgba(74,222,128,0.4)" : "1px solid #27272a",
        background: "#18181b",
        overflow: "hidden",
        boxShadow: glow
          ? "0 0 40px rgba(74,222,128,0.1), inset 0 1px 0 rgba(74,222,128,0.05)"
          : "0 4px 24px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
