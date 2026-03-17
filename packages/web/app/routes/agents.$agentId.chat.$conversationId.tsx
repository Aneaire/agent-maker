import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useParams, useOutletContext, Link } from "react-router";
import { ChatMessageList } from "~/components/ChatMessageList";
import { ChatInput } from "~/components/ChatInput";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";

export default function ChatPage() {
  const { conversationId } = useParams();
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();

  const conversation = useQuery(api.conversations.get, {
    conversationId: conversationId as Id<"conversations">,
  });
  const messages = useQuery(api.messages.list, {
    conversationId: conversationId as Id<"conversations">,
  });
  const sendMessage = useMutation(api.messages.send);
  const stopMessage = useMutation(api.messages.stop);
  const updateAgent = useMutation(api.agents.update);

  // Loading state
  if (conversation === undefined || messages === undefined) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="border-b border-zinc-800 px-6 py-3">
          <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="flex-1 animate-pulse" />
      </div>
    );
  }

  // Not found
  if (conversation === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Conversation not found</p>
          <Link
            to={`/agents/${agent._id}`}
            className="text-sm text-zinc-300 hover:text-zinc-100 underline underline-offset-4"
          >
            Back to agent
          </Link>
        </div>
      </div>
    );
  }

  const hasActiveRun = messages.some(
    (m) => m.status === "pending" || m.status === "processing"
  );

  async function handleSend(content: string) {
    try {
      await sendMessage({
        conversationId: conversationId as Id<"conversations">,
        content,
      });
    } catch (err: any) {
      console.error("Failed to send message:", err);
    }
  }

  async function handleStop() {
    try {
      await stopMessage({
        conversationId: conversationId as Id<"conversations">,
      });
    } catch (err: any) {
      console.error("Failed to stop:", err);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-medium">
            {conversation.title || "New conversation"}
          </h2>
          <p className="text-xs text-zinc-500">{agent.name}</p>
        </div>
      </div>

      {/* Messages */}
      <ChatMessageList messages={messages} onSendSuggestion={handleSend} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isProcessing={hasActiveRun}
        model={agent.model}
        onModelChange={(model) => updateAgent({ agentId: agent._id, model })}
      />
    </div>
  );
}
