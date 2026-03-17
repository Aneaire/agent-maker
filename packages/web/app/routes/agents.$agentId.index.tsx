import { useOutletContext, useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { Bot, MessageSquare, Wand2 } from "lucide-react";
import { Link } from "react-router";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

export default function AgentIndexPage() {
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();
  const navigate = useNavigate();
  const createConversation = useMutation(api.conversations.create);

  async function handleStartChat() {
    const id = await createConversation({ agentId: agent._id });
    navigate(`/agents/${agent._id}/chat/${id}`);
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {agent.iconUrl ? (
          <img src={agent.iconUrl} alt="" className="h-16 w-16 rounded-full object-cover mx-auto mb-6" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 mx-auto mb-6">
            <Bot className="h-8 w-8 text-zinc-300" />
          </div>
        )}
        <h1 className="text-2xl font-bold mb-2">{agent.name}</h1>
        {agent.description && (
          <p className="text-zinc-400 mb-8">{agent.description}</p>
        )}

        <div className="grid gap-3">
          <button
            onClick={handleStartChat}
            className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 cursor-pointer transition-colors text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">Start a Chat</div>
              <div className="text-sm text-zinc-500">
                Begin a new conversation
              </div>
            </div>
          </button>

          <Link
            to={`/agents/${agent._id}/editor`}
            className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium">Edit with AI</div>
              <div className="text-sm text-zinc-500">
                Update config, pages, and API endpoints with AI
              </div>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
