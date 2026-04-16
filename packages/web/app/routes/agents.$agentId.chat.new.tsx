import { useOutletContext, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { ChatInput, type ChatAttachment } from "~/components/ChatInput";
import { Link } from "react-router";
import { Pencil } from "lucide-react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import { useMemo } from "react";

export default function NewChatPage() {
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();
  const navigate = useNavigate();
  const createConversation = useMutation(api.conversations.create);
  const sendMessage = useMutation(api.messages.send);
  const updateAgent = useMutation(api.agents.update);
  const linkedCredentials = useQuery(api.credentials.listForAgent, { agentId: agent._id });

  const configuredImageGenProviders = useMemo(() => {
    const providers: string[] = ["gemini"];
    if (linkedCredentials) {
      for (const link of linkedCredentials) {
        if (
          link.toolSetName === "image_generation" &&
          link.credentialType === "image_gen_nano_banana" &&
          !providers.includes("nano_banana")
        ) {
          providers.push("nano_banana");
        }
      }
    }
    return providers;
  }, [linkedCredentials]);

  async function handleSend(content: string, attachments?: ChatAttachment[]) {
    const id = await createConversation({ agentId: agent._id });
    await sendMessage({
      conversationId: id,
      content,
      attachments: attachments as any,
    });
    navigate(`/agents/${agent._id}/chat/${id}`, { replace: true });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-rule px-8 py-4 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="eyebrow">{agent.name}</p>
          <h2 className="mt-1 font-display text-lg leading-tight text-ink-faint">
            New conversation
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

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <p className="font-display text-2xl text-ink mb-2">{agent.name}</p>
          {agent.description && (
            <p className="text-sm text-ink-faint leading-relaxed">{agent.description}</p>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isProcessing={false}
        model={agent.model}
        onModelChange={(model) => updateAgent({ agentId: agent._id, model })}
        enabledModels={agent.enabledModels}
        agentId={agent._id}
      />
    </div>
  );
}
