import { Link } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { Trash2, GripVertical } from "lucide-react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Variant = "row" | "tile";

const STATUS_LABEL: Record<Doc<"agents">["status"], string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
};

function StatusMark({ status }: { status: Doc<"agents">["status"] }) {
  const color =
    status === "active"
      ? "bg-accent"
      : status === "paused"
        ? "bg-warn"
        : "bg-rule-strong";
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatDate(t: number) {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function AgentCard({
  agent,
  isDraggable = false,
  variant = "row",
  index,
}: {
  agent: Doc<"agents">;
  isDraggable?: boolean;
  variant?: Variant;
  index?: number;
}) {
  const removeAgent = useMutation(api.agents.remove);
  const sortable = isDraggable ? useSortable({ id: agent._id }) : null;

  const style = sortable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
    : undefined;

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete "${agent.name}"?`)) {
      removeAgent({ agentId: agent._id });
    }
  };

  if (variant === "row") {
    return (
      <li
        ref={sortable?.setNodeRef}
        style={style}
        className={`group relative ${
          sortable?.isDragging ? "opacity-60" : ""
        }`}
      >
        <Link
          to={`/agents/${agent._id}`}
          className="grid grid-cols-[3ch_1fr_auto] gap-6 items-baseline py-5 px-1 hover:bg-surface-sunken/60 transition-colors"
        >
          <span className="font-mono text-2xs text-ink-faint tabular-nums">
            {index !== undefined ? String(index).padStart(2, "0") : ""}
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="font-display text-xl leading-tight text-ink truncate">
                {agent.name}
              </h3>
              <span className="font-mono text-2xs text-ink-faint">
                {agent.model}
              </span>
            </div>
            {agent.description && (
              <p className="mt-1.5 text-sm text-ink-muted leading-relaxed line-clamp-2 max-w-[65ch]">
                {agent.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 pt-1 shrink-0">
            <StatusMark status={agent.status} />
            <span className="text-2xs text-ink-faint tabular-nums">
              {formatDate(agent._creationTime)}
            </span>
          </div>
        </Link>

        {/* Hover actions */}
        <div className="absolute top-4 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          {isDraggable && (
            <button
              {...sortable?.attributes}
              {...sortable?.listeners}
              aria-label="Drag to reorder"
              className="p-1.5 text-ink-faint hover:text-ink-muted cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={handleDelete}
            aria-label={`Delete ${agent.name}`}
            className="p-1.5 text-ink-faint hover:text-danger transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </li>
    );
  }

  // tile variant
  return (
    <article
      ref={sortable?.setNodeRef}
      style={style}
      className={`group relative ${
        sortable?.isDragging ? "opacity-60" : ""
      }`}
    >
      <Link to={`/agents/${agent._id}`} className="block py-1">
        <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
          <StatusMark status={agent.status} />
          <span className="text-2xs text-ink-faint tabular-nums">
            {formatDate(agent._creationTime)}
          </span>
        </div>
        <h3 className="mt-4 font-display text-2xl leading-[1.1] text-ink line-clamp-2">
          {agent.name}
        </h3>
        {agent.description && (
          <p className="mt-3 text-sm text-ink-muted leading-relaxed line-clamp-3">
            {agent.description}
          </p>
        )}
        <p className="mt-4 font-mono text-2xs text-ink-faint">
          {agent.model}
        </p>
      </Link>

      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        {isDraggable && (
          <button
            {...sortable?.attributes}
            {...sortable?.listeners}
            aria-label="Drag to reorder"
            className="p-1 text-ink-faint hover:text-ink-muted cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={handleDelete}
          aria-label={`Delete ${agent.name}`}
          className="p-1 text-ink-faint hover:text-danger transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </article>
  );
}
