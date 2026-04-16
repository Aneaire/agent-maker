import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useOutletContext } from "react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";

export default function MemoriesPage() {
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const memories = useQuery(api.memories.list, { agentId: agent._id });
  const searchResults = useQuery(
    api.memories.search,
    searchQuery.trim()
      ? { agentId: agent._id, query: searchQuery.trim() }
      : "skip"
  );
  const removeMemory = useMutation(api.memories.remove);

  const allCategories = Array.from(
    new Set(memories?.map((m) => m.category).filter(Boolean) as string[])
  ).sort();

  let displayMemories = searchQuery.trim() ? searchResults : memories;
  if (filterCategory && displayMemories) {
    displayMemories = displayMemories.filter(
      (m) => m.category === filterCategory
    );
  }

  async function handleDelete(memoryId: Id<"memories">) {
    if (!confirm("Delete this memory?")) return;
    await removeMemory({ memoryId });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <header className="border-b border-rule px-8 py-6 shrink-0">
        <div className="max-w-3xl">
          <p className="eyebrow">Long-term context</p>
          <h1 className="mt-2 font-display text-3xl leading-[1.05] tracking-tight text-ink">
            Memories
          </h1>
          {memories && (
            <p className="mt-2 text-sm text-ink-muted">
              {memories.length} memor{memories.length !== 1 ? "ies" : "y"} stored
              &middot; created automatically during conversations
            </p>
          )}
        </div>
      </header>

      {/* Search + filters */}
      <div className="border-b border-rule px-8 py-4 shrink-0">
        <div className="max-w-3xl space-y-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories"
            className="w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
          />

          {allCategories.length > 0 && (
            <div className="flex flex-wrap gap-4 text-2xs uppercase tracking-[0.12em] font-semibold">
              <button
                onClick={() => setFilterCategory(null)}
                className={`transition-colors ${
                  !filterCategory ? "text-ink" : "text-ink-faint hover:text-ink-muted"
                }`}
              >
                All
              </button>
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setFilterCategory(filterCategory === cat ? null : cat)
                  }
                  className={`transition-colors ${
                    filterCategory === cat
                      ? "text-accent"
                      : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl">
          {displayMemories === undefined ? (
            <div className="space-y-[1px]">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-surface-sunken animate-pulse" />
              ))}
            </div>
          ) : displayMemories.length === 0 ? (
            <div className="py-16 max-w-md">
              <p className="eyebrow">Empty</p>
              <h2 className="mt-2 font-display text-2xl leading-tight text-ink">
                {searchQuery.trim() || filterCategory
                  ? "No memories match."
                  : "No memories stored yet."}
              </h2>
              <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                {searchQuery.trim() || filterCategory
                  ? "Try a different search or clear the filter."
                  : "Your agent will start remembering things from conversations as soon as it has context worth keeping."}
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-rule border-y border-rule">
              {displayMemories.map((memory, i) => (
                <li key={memory._id} className="group">
                  <div className="grid grid-cols-[3ch_1fr_auto] gap-6 items-start py-5">
                    <span className="font-mono text-2xs text-ink-faint tabular-nums pt-1">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-ink leading-relaxed max-w-[65ch]">
                        {memory.content}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-2xs">
                        {memory.category && (
                          <span className="uppercase tracking-[0.12em] font-semibold text-accent">
                            {memory.category}
                          </span>
                        )}
                        <span className="font-mono text-ink-faint tabular-nums">
                          {new Date(memory._creationTime).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(memory._id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-ink-faint hover:text-danger transition-all shrink-0"
                      aria-label="Delete memory"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
