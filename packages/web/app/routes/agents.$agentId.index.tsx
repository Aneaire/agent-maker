import { useOutletContext, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { Bot, MessageSquare, Wand2, Brain, Calendar, Wrench } from "lucide-react";
import { Link } from "react-router";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

export default function AgentIndexPage() {
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();
  const navigate = useNavigate();
  const createConversation = useMutation(api.conversations.create);
  const conversations = useQuery(api.conversations.list, { agentId: agent._id });
  const memories = useQuery(api.memories.list, { agentId: agent._id });

  async function handleStartChat() {
    const id = await createConversation({ agentId: agent._id });
    navigate(`/agents/${agent._id}/chat/${id}`);
  }

  const enabledTools = agent.enabledToolSets ?? [];

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Decorative pattern behind icon */}
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-br from-neon-400/5 to-transparent blur-xl" />
          <div className="absolute -top-3 -right-3 h-2 w-2 rounded-full bg-neon-400/20" />
          <div className="absolute -bottom-2 -left-4 h-1.5 w-1.5 rounded-full bg-zinc-600/30" />
          {agent.iconUrl ? (
            <img src={agent.iconUrl} alt="" className="relative h-16 w-16 rounded-full object-cover ring-2 ring-zinc-800" />
          ) : (
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 ring-1 ring-zinc-700/50">
              <Bot className="h-8 w-8 text-zinc-300" />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-2">{agent.name}</h1>
        {agent.description && (
          <p className="text-zinc-400 mb-4">{agent.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <MessageSquare className="h-3.5 w-3.5" />
            {conversations?.length ?? 0} chats
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Brain className="h-3.5 w-3.5" />
            {memories?.length ?? 0} memories
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(agent._creationTime).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>

        {/* Enabled tool sets */}
        {enabledTools.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-8">
            {enabledTools.slice(0, 6).map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800/60 text-zinc-500 border border-zinc-800/80"
              >
                <Wrench className="h-2.5 w-2.5" />
                {tool.replace(/_/g, " ")}
              </span>
            ))}
            {enabledTools.length > 6 && (
              <span className="text-[10px] text-zinc-600 px-2 py-0.5">
                +{enabledTools.length - 6} more
              </span>
            )}
          </div>
        )}

        <div className="grid gap-3">
          <button
            onClick={handleStartChat}
            className="group flex items-center gap-4 rounded-xl border border-zinc-800/60 glass-card p-4 hover:border-zinc-700 hover:glass-card-hover cursor-pointer transition-all text-left hover-lift"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neon-400/10 text-neon-400 group-hover:bg-neon-400/15 transition-colors">
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
            className="group flex items-center gap-4 rounded-xl border border-zinc-800/60 glass-card p-4 hover:border-zinc-700 hover:glass-card-hover transition-all text-left hover-lift"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-400/10 text-purple-400 group-hover:bg-purple-400/15 transition-colors">
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
