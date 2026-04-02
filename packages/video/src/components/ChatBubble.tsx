import React from "react";

type ChatBubbleProps = {
  role: "user" | "agent";
  text: string;
  opacity?: number;
  translateY?: number;
};

export const ChatBubble = ({ role, text, opacity = 1, translateY = 0 }: ChatBubbleProps) => {
  const isUser = role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        opacity,
        transform: `translateY(${translateY}px)`,
        marginBottom: 16,
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #4ade80, #22c55e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            flexShrink: 0,
            fontSize: 16,
            boxShadow: "0 0 12px rgba(74,222,128,0.4)",
          }}
        >
          ✦
        </div>
      )}
      <div
        style={{
          maxWidth: "70%",
          padding: "12px 18px",
          borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
          background: isUser ? "#27272a" : "rgba(74,222,128,0.08)",
          border: isUser ? "1px solid #3f3f46" : "1px solid rgba(74,222,128,0.25)",
          color: isUser ? "#d4d4d8" : "#f4f4f5",
          fontSize: 18,
          lineHeight: 1.5,
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        }}
      >
        {text}
      </div>
    </div>
  );
};
