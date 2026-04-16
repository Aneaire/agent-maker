import { useOutletContext, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { MessageSquare, Wand2, Brain, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

export default function AgentIndexPage() {
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();
  const navigate = useNavigate();
  const conversations = useQuery(api.conversations.list, { agentId: agent._id });
  const memories = useQuery(api.memories.list, { agentId: agent._id });

  function handleStartChat() {
    navigate(`/agents/${agent._id}/chat/new`);
  }

  const enabledTools = agent.enabledToolSets ?? [];

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center">
      <div className="max-w-xl w-full px-10 py-16">

        {/* ── Identity ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-8">
          {agent.iconUrl ? (
            <img
              src={agent.iconUrl}
              alt=""
              className="h-10 w-10 object-cover shrink-0"
            />
          ) : (
            <div className="h-10 w-10 bg-surface-sunken border border-rule shrink-0" />
          )}
          <p className="eyebrow text-ink-faint">{agent.model ?? "Agent"}</p>
        </div>

        <h1 className="font-display text-5xl leading-[1] tracking-tight text-ink mb-5">
          {agent.name}
        </h1>

        {agent.description && (
          <p className="text-base text-ink-muted leading-relaxed mb-10 max-w-md">
            {agent.description}
          </p>
        )}

        {/* ── Stats ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 border border-rule divide-x divide-rule mb-8">
          <StatCell label="Chats" value={conversations?.length} />
          <StatCell label="Memories" value={memories?.length} />
          <StatCell
            label="Since"
            value={new Date(agent._creationTime).toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          />
        </div>

        {/* ── Enabled tool sets ────────────────────────────────────── */}
        {enabledTools.length > 0 && (
          <div className="mb-10">
            <p className="eyebrow mb-3">Integrations</p>
            <div className="flex flex-wrap gap-1.5">
              {enabledTools.slice(0, 14).map((tool) => (
                <span
                  key={tool}
                  className="px-2.5 py-1 text-[11px] text-ink-muted border border-rule bg-surface-sunken/60 font-medium"
                >
                  {tool.replace(/_/g, " ")}
                </span>
              ))}
              {enabledTools.length > 14 && (
                <span className="px-2.5 py-1 text-[11px] text-ink-faint border border-rule/50">
                  +{enabledTools.length - 14}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────── */}
        <div className="border-t border-rule">
          <ActionRow
            title="Start a chat"
            description="Begin a new conversation."
            icon={<MessageSquare className="h-4 w-4" strokeWidth={1.5} />}
            onClick={handleStartChat}
            primary
          />
          <ActionRow
            title="Edit with AI"
            description="Update system prompt, pages, and tools."
            icon={<Wand2 className="h-4 w-4" strokeWidth={1.5} />}
            to={`/agents/${agent._id}/editor`}
          />
        </div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}) {
  return (
    <div className="px-5 py-4">
      <p className="eyebrow text-ink-faint mb-1.5">{label}</p>
      {value === undefined ? (
        /* font-display text-2xl leading-none → 24px */
        <div className="h-6 w-10 bg-surface-sunken animate-pulse" />
      ) : (
        <p className="font-display text-2xl text-ink tabular-nums leading-none">
          {value}
        </p>
      )}
    </div>
  );
}

function ActionRow({
  title,
  description,
  icon,
  onClick,
  to,
  primary,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
  to?: string;
  primary?: boolean;
}) {
  const content = (
    <div className={`group flex items-center gap-5 py-5 border-b border-rule transition-colors ${primary ? "hover:bg-surface-sunken/40" : "hover:bg-surface-sunken/20"}`}>
      <div className={`h-9 w-9 flex items-center justify-center border border-rule shrink-0 transition-colors ${primary ? "bg-ink text-surface group-hover:bg-ink-muted" : "bg-surface-sunken text-ink-muted group-hover:text-ink"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${primary ? "text-ink" : "text-ink-muted"}`}>
          {title}
        </p>
        <p className="text-xs text-ink-faint mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight
        className="h-4 w-4 text-ink-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0"
        strokeWidth={1.5}
      />
    </div>
  );

  if (to) return <Link to={to} className="block">{content}</Link>;
  return (
    <button onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}
