import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useParams, useOutletContext, Link } from "react-router";
import { ChatMessageList } from "~/components/ChatMessageList";
import { ChatInput, type ChatAttachment } from "~/components/ChatInput";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import { useMemo } from "react";
import { Pencil } from "lucide-react";

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
  const linkedCredentials = useQuery(api.credentials.listForAgent, { agentId: agent._id });

  // Determine which image gen providers have credentials available
  // Image gen models are independent from the agent's chat model
  const configuredImageGenProviders = useMemo(() => {
    const providers: string[] = [];

    // Gemini Imagen is always available via GEMINI_API_KEY env var on the server
    providers.push("gemini");

    // Also check credential system links for additional providers
    if (linkedCredentials) {
      for (const link of linkedCredentials) {
        if (link.toolSetName === "image_generation") {
          if (link.credentialType === "image_gen_nano_banana" && !providers.includes("nano_banana")) {
            providers.push("nano_banana");
          }
        }
      }
    }

    return providers;
  }, [linkedCredentials]);

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

  async function handleSend(content: string, attachments?: ChatAttachment[]) {
    try {
      await sendMessage({
        conversationId: conversationId as Id<"conversations">,
        content,
        attachments: attachments as any,
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
        <Link
          to={`/agents/${agent._id}/editor`}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit with AI
        </Link>
      </div>

      {/* Messages */}
      <ChatMessageList messages={messages} onSendSuggestion={handleSend} agentId={agent._id} configuredImageGenProviders={configuredImageGenProviders} />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isProcessing={hasActiveRun}
        model={agent.model}
        onModelChange={(model) => updateAgent({ agentId: agent._id, model })}
        enabledModels={agent.enabledModels}
        agentId={agent._id}
      />
    </div>
  );
}
