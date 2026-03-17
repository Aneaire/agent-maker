import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useOutletContext } from "react-router";
import { Brain, Trash2, Search, Tag, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  preference: { bg: "bg-blue-950/50 ring-1 ring-blue-500/20", text: "text-blue-400" },
  fact: { bg: "bg-neon-950/50 ring-1 ring-neon-500/20", text: "text-neon-400" },
  instruction: { bg: "bg-amber-950/50 ring-1 ring-amber-500/20", text: "text-amber-400" },
  context: { bg: "bg-purple-950/50 ring-1 ring-purple-500/20", text: "text-purple-400" },
};

function getCategoryStyle(category: string) {
  return (
    CATEGORY_COLORS[category.toLowerCase()] ?? {
      bg: "bg-zinc-800/50 ring-1 ring-zinc-700/30",
      text: "text-zinc-400",
    }
  );
}

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

  // Collect all unique categories
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
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
            <Brain className="h-4 w-4 text-zinc-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Memories</h2>
            {memories && (
              <p className="text-xs text-zinc-500">
                {memories.length} memor{memories.length !== 1 ? "ies" : "y"} stored
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-6 py-3 border-b border-zinc-800/60 space-y-2.5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
          />
        </div>

        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filterCategory && (
              <button
                onClick={() => setFilterCategory(null)}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                All
              </button>
            )}
            {allCategories.map((cat) => {
              const style = getCategoryStyle(cat);
              return (
                <button
                  key={cat}
                  onClick={() =>
                    setFilterCategory(filterCategory === cat ? null : cat)
                  }
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                    filterCategory === cat
                      ? `${style.bg} ${style.text}`
                      : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {displayMemories === undefined ? (
          <div className="space-y-3 max-w-2xl">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-zinc-900/30 animate-pulse"
              />
            ))}
          </div>
        ) : displayMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 mb-5">
              <Brain className="h-7 w-7 text-zinc-700" />
            </div>
            <p className="text-zinc-400 font-medium">
              {searchQuery.trim() || filterCategory
                ? "No memories match"
                : "No memories stored yet"}
            </p>
            <p className="text-zinc-600 text-sm mt-1.5 max-w-xs">
              {searchQuery.trim() || filterCategory
                ? "Try a different search or filter"
                : "Memories are automatically created during conversations to give your agent long-term context"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-w-2xl">
            {displayMemories.map((memory) => (
              <div
                key={memory._id}
                className="group rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-4 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800/60 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 leading-relaxed">
                      {memory.content}
                    </p>
                    {memory.category && (
                      <span
                        className={`inline-flex items-center gap-1 mt-2.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          getCategoryStyle(memory.category).bg
                        } ${getCategoryStyle(memory.category).text}`}
                      >
                        {memory.category}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(memory._id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
