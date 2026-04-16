import { useEffect, useRef, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import type { Doc, Id } from "@agent-maker/shared/convex/_generated/dataModel";

export function ChatMessageList({
  messages,
  onSendSuggestion,
  agentId,
  configuredImageGenProviders,
}: {
  messages: Doc<"messages">[];
  onSendSuggestion?: (content: string) => void;
  agentId?: Id<"agents">;
  configuredImageGenProviders?: string[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    userScrolledUp.current = distanceFromBottom > 200;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || userScrolledUp.current) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-ink-faint">
          Send a message to start the conversation.
        </p>
      </div>
    );
  }

  const lastMsg = messages[messages.length - 1];
  const showSuggestionsFor =
    lastMsg?.role === "assistant" && lastMsg?.status === "done"
      ? lastMsg._id
      : null;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-6 py-8"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg) => (
          <ChatMessage
            key={msg._id}
            message={msg}
            showSuggestions={msg._id === showSuggestionsFor}
            onSendSuggestion={onSendSuggestion}
            agentId={agentId}
            configuredImageGenProviders={configuredImageGenProviders}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
