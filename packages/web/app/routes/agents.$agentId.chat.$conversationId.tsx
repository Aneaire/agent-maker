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

  const configuredImageGenProviders = useMemo(() => {
    const providers: string[] = [];
    providers.push("gemini");
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

  if (conversation === undefined || messages === undefined) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="border-b border-rule px-6 py-3">
          <div className="h-4 w-40 bg-surface-sunken rounded-xs animate-pulse" />
        </div>
        <div className="flex-1 animate-pulse bg-surface" />
      </div>
    );
  }

  if (conversation === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-sm">
          <p className="eyebrow">404</p>
          <h2 className="mt-2 font-display text-2xl text-ink leading-tight">
            Conversation not found.
          </h2>
          <Link
            to={`/agents/${agent._id}`}
            className="mt-4 inline-block text-sm text-accent hover:text-accent-strong transition-colors"
          >
            &larr; Back to agent
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
      <div className="border-b border-rule px-8 py-4 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="eyebrow">{agent.name}</p>
          <h2 className="mt-1 font-display text-lg leading-tight text-ink truncate">
            {conversation.title || "New conversation"}
          </h2>
        </div>
        <Link
          to={`/agents/${agent._id}/editor`}
          className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <Pencil className="h-3 w-3" strokeWidth={1.5} />
          Edit with AI
        </Link>
      </div>

      {/* Messages */}
      <ChatMessageList
        messages={messages}
        onSendSuggestion={handleSend}
        agentId={agent._id}
        configuredImageGenProviders={configuredImageGenProviders}
      />

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
