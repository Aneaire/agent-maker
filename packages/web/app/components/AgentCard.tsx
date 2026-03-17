import { Link } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  Bot,
  Trash2,
  MessageSquare,
  Zap,
  Clock,
  GripVertical,
} from "lucide-react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const statusConfig = {
  active: {
    dot: "bg-neon-400",
    bg: "bg-neon-950/50",
    text: "text-neon-400",
    glow: "shadow-neon-500/10",
    label: "Active",
  },
  paused: {
    dot: "bg-amber-400",
    bg: "bg-amber-950/50",
    text: "text-amber-400",
    glow: "shadow-amber-500/10",
    label: "Paused",
  },
  draft: {
    dot: "bg-zinc-500",
    bg: "bg-zinc-800/50",
    text: "text-zinc-400",
    glow: "",
    label: "Draft",
  },
};

export function AgentCard({
  agent,
  isDraggable = false,
}: {
  agent: Doc<"agents">;
  isDraggable?: boolean;
}) {
  const removeAgent = useMutation(api.agents.remove);
  const status = statusConfig[agent.status] ?? statusConfig.draft;

  const sortable = isDraggable
    ? useSortable({ id: agent._id })
    : null;

  const style = sortable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
    : undefined;

  return (
    <div
      ref={sortable?.setNodeRef}
      style={style}
      className={`group relative rounded-2xl border border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 overflow-hidden ${
        sortable?.isDragging ? "opacity-50 scale-[1.02]" : ""
      }`}
    >
      {/* Subtle top accent line */}
      <div
        className={`h-[2px] w-full ${
          agent.status === "active"
            ? "bg-gradient-to-r from-transparent via-neon-400/40 to-transparent"
            : agent.status === "paused"
              ? "bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
              : "bg-gradient-to-r from-transparent via-zinc-700/40 to-transparent"
        }`}
      />

      <div className="p-5">
        {/* Drag handle */}
        {isDraggable && (
          <button
            {...sortable?.attributes}
            {...sortable?.listeners}
            className="absolute top-4 right-12 opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing transition-all"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Delete */}
        <button
          onClick={(e) => {
            e.preventDefault();
            if (confirm(`Delete "${agent.name}"?`)) {
              removeAgent({ agentId: agent._id });
            }
          }}
          className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-950/50 text-zinc-600 hover:text-red-400 transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <Link to={`/agents/${agent._id}`} className="block">
          {/* Icon + Name */}
          <div className="flex items-start gap-3.5">
            {agent.iconUrl ? (
              <img src={agent.iconUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-zinc-700/50">
                <Bot className="h-5 w-5 text-zinc-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-zinc-100 truncate leading-tight">
                {agent.name}
              </h3>
              {agent.description && (
                <p className="mt-1.5 text-sm text-zinc-500 line-clamp-2 leading-relaxed">
                  {agent.description}
                </p>
              )}
            </div>
          </div>

          {/* Footer meta */}
          <div className="mt-4 flex items-center gap-3 pt-3 border-t border-zinc-800/50">
            {/* Status badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.text}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.dot} ${
                  agent.status === "active" ? "animate-pulse" : ""
                }`}
              />
              {status.label}
            </span>

            {/* Model */}
            <span className="flex items-center gap-1 text-xs text-zinc-600">
              <Zap className="h-3 w-3" />
              {agent.model}
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
