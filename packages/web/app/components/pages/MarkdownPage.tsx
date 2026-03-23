import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  Type,
  Plus,
  Trash2,
  Search,
  Tag,
  X,
  FileText,
  Pencil,
  Eye,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Toggle the Nth checkbox in raw markdown content (0-indexed) */
function toggleCheckboxInMarkdown(content: string, index: number): string {
  const checkboxRegex = /- \[([ xX])\]/g;
  let count = 0;
  return content.replace(checkboxRegex, (match, check) => {
    if (count++ === index) {
      return check === " " ? "- [x]" : "- [ ]";
    }
    return match;
  });
}

export function MarkdownPage({ tab }: { tab: Doc<"sidebarTabs"> }) {
  const notes = useQuery(api.tabNotes.list, { tabId: tab._id });
  const createNote = useMutation(api.tabNotes.create);
  const updateNote = useMutation(api.tabNotes.update);
  const removeNote = useMutation(api.tabNotes.remove);
  const [selectedId, setSelectedId] = useState<Id<"tabNotes"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Migrate: if old config.content exists and no notes yet, create one
  const config = tab.config as { content?: string } | undefined;
  const hasMigrated = useRef(false);
  useEffect(() => {
    if (
      config?.content &&
      notes !== undefined &&
      notes.length === 0 &&
      !hasMigrated.current
    ) {
      hasMigrated.current = true;
      createNote({
        tabId: tab._id,
        title: tab.label,
        content: config.content,
      }).then((id) => setSelectedId(id));
    }
  }, [notes, config?.content]);

  const searchResults = useQuery(
    api.tabNotes.search,
    searchQuery.trim()
      ? { tabId: tab._id, query: searchQuery.trim() }
      : "skip"
  );

  // Collect all tags from notes
  const allTags = Array.from(
    new Set(notes?.flatMap((n) => n.tags ?? []) ?? [])
  ).sort();

  // Filter notes
  let displayNotes = searchQuery.trim() ? searchResults : notes;
  if (filterTag && displayNotes) {
    displayNotes = displayNotes.filter((n) =>
      (n.tags ?? []).includes(filterTag)
    );
  }

  const selectedNote = notes?.find((n) => n._id === selectedId);

  async function handleCreate() {
    const id = await createNote({
      tabId: tab._id,
      title: "Untitled",
      content: "",
    });
    setSelectedId(id);
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* Sidebar */}
      <div className="w-72 border-r border-zinc-800/60 flex flex-col shrink-0 bg-zinc-950/50">
        {/* Header */}
        <div className="px-4 py-4 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/80">
              <Type className="h-3.5 w-3.5 text-zinc-300" />
            </div>
            <span className="text-sm font-semibold">{tab.label}</span>
            {notes && (
              <span className="text-xs text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">
                {notes.length}
              </span>
            )}
          </div>
          <button
            onClick={handleCreate}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        </div>

        {/* Tags filter */}
        {allTags.length > 0 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {filterTag && (
              <button
                onClick={() => setFilterTag(null)}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                All
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setFilterTag(filterTag === tag ? null : tag)
                }
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                  filterTag === tag
                    ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                    : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {displayNotes === undefined ? (
            <div className="space-y-1.5 px-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-zinc-900/50 animate-pulse"
                />
              ))}
            </div>
          ) : displayNotes.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileText className="h-8 w-8 text-zinc-800 mb-2" />
              <p className="text-xs text-zinc-600">
                {searchQuery || filterTag ? "No matches" : "No documents yet"}
              </p>
              {!searchQuery && !filterTag && (
                <button
                  onClick={handleCreate}
                  className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
                >
                  Create one
                </button>
              )}
            </div>
          ) : (
            displayNotes.map((note) => (
              <button
                key={note._id}
                onClick={() => setSelectedId(note._id)}
                className={`w-full text-left rounded-xl px-3.5 py-3 transition-all ${
                  selectedId === note._id
                    ? "bg-zinc-800 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
              >
                <div className="text-sm font-medium truncate">
                  {note.title}
                </div>
                <div className="text-xs text-zinc-600 truncate mt-1 leading-relaxed">
                  {note.content.substring(0, 60) || "Empty document"}
                </div>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-800/60 text-zinc-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedNote ? (
          <MarkdownEditor
            note={selectedNote}
            onUpdate={(updates) =>
              updateNote({ noteId: selectedNote._id, ...updates })
            }
            onDelete={() => {
              removeNote({ noteId: selectedNote._id });
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Type className="h-12 w-12 text-zinc-800 mb-3" />
            <p className="text-zinc-500 font-medium">No document selected</p>
            <p className="text-sm text-zinc-600 mt-1">
              Select a document or create a new one
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Markdown Editor with preview ───────────────────────────────────

function MarkdownEditor({
  note,
  onUpdate,
  onDelete,
}: {
  note: Doc<"tabNotes">;
  onUpdate: (updates: {
    title?: string;
    content?: string;
    tags?: string[];
  }) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [localTitle, setLocalTitle] = useState(note.title);
  const [localContent, setLocalContent] = useState(note.content);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const titleTimer = useRef<ReturnType<typeof setTimeout>>();
  const contentTimer = useRef<ReturnType<typeof setTimeout>>();
  const isTitleFocused = useRef(false);
  const isContentFocused = useRef(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const tags = note.tags ?? [];

  // Sync from server when not editing
  useEffect(() => {
    if (!isTitleFocused.current) setLocalTitle(note.title);
  }, [note.title]);

  useEffect(() => {
    if (!isContentFocused.current) setLocalContent(note.content);
  }, [note.content]);

  // Reset local state when switching notes
  useEffect(() => {
    setLocalTitle(note.title);
    setLocalContent(note.content);
    setMode("preview");
  }, [note._id]);

  useEffect(() => {
    return () => {
      clearTimeout(titleTimer.current);
      clearTimeout(contentTimer.current);
    };
  }, []);

  useEffect(() => {
    if (showTagInput) tagInputRef.current?.focus();
  }, [showTagInput]);

  function handleTitleChange(value: string) {
    setLocalTitle(value);
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => onUpdate({ title: value }), 500);
  }

  function handleContentChange(value: string) {
    setLocalContent(value);
    clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => onUpdate({ content: value }), 500);
  }

  function handleTitleBlur() {
    isTitleFocused.current = false;
    clearTimeout(titleTimer.current);
    if (localTitle !== note.title) onUpdate({ title: localTitle });
  }

  function handleContentBlur() {
    isContentFocused.current = false;
    clearTimeout(contentTimer.current);
    if (localContent !== note.content) onUpdate({ content: localContent });
  }

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    onUpdate({ tags: [...tags, t] });
    setTagInput("");
  }

  function removeTag(tag: string) {
    onUpdate({ tags: tags.filter((t) => t !== tag) });
  }

  // Track checkbox index during render for interactive toggling
  const checkboxIndex = useRef(0);

  const markdownComponents = useMemo(() => {
    return {
      input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
        if (props.type === "checkbox") {
          const idx = checkboxIndex.current++;
          return (
            <input
              type="checkbox"
              checked={props.checked}
              onChange={() => {
                const updated = toggleCheckboxInMarkdown(localContent, idx);
                setLocalContent(updated);
                onUpdate({ content: updated });
              }}
              className="cursor-pointer accent-blue-500 h-4 w-4 rounded border-zinc-600 align-middle mr-1"
            />
          );
        }
        return <input {...props} />;
      },
    };
  }, [localContent, onUpdate]);

  // Reset checkbox counter before each render
  checkboxIndex.current = 0;

  return (
    <>
      {/* Toolbar */}
      <div className="border-b border-zinc-800/60 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            onFocus={() => (isTitleFocused.current = true)}
            onBlur={handleTitleBlur}
            className="bg-transparent text-base font-semibold text-zinc-100 focus:outline-none flex-1 min-w-0"
            placeholder="Document title..."
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tag button */}
          <button
            onClick={() => setShowTagInput(!showTagInput)}
            className={`p-2 rounded-lg transition-all ${
              showTagInput || tags.length > 0
                ? "text-blue-400 bg-blue-500/10"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
            }`}
            title="Manage tags"
          >
            <Tag className="h-4 w-4" />
          </button>

          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/50 p-0.5 ml-1">
            <button
              onClick={() => setMode("edit")}
              className={`p-1.5 rounded-md transition-colors ${
                mode === "edit"
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`p-1.5 rounded-md transition-colors ${
                mode === "preview"
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Preview"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all ml-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tags bar */}
      {(showTagInput || tags.length > 0) && (
        <div className="border-b border-zinc-800/60 px-6 py-2.5 flex items-center gap-2 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:text-blue-200 transition-colors ml-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {showTagInput && (
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  addTag(tagInput);
                } else if (
                  e.key === "Backspace" &&
                  !tagInput &&
                  tags.length > 0
                ) {
                  removeTag(tags[tags.length - 1]);
                } else if (e.key === "Escape") {
                  setShowTagInput(false);
                  setTagInput("");
                }
              }}
              placeholder="Add tag..."
              className="bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none min-w-[80px]"
            />
          )}
        </div>
      )}

      {/* Content */}
      {mode === "edit" ? (
        <textarea
          value={localContent}
          onChange={(e) => handleContentChange(e.target.value)}
          onFocus={() => (isContentFocused.current = true)}
          onBlur={handleContentBlur}
          placeholder="Write markdown here..."
          className="flex-1 bg-transparent px-6 py-5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none resize-none font-mono leading-relaxed"
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {localContent ? (
            <div className="max-w-2xl mx-auto prose prose-invert prose-sm prose-zinc prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-a:text-blue-400 prose-strong:text-zinc-200 prose-code:text-zinc-300 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-blockquote:border-zinc-700 prose-hr:border-zinc-800 prose-th:text-zinc-300 prose-td:text-zinc-400">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {localContent}
              </Markdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Pencil className="h-8 w-8 text-zinc-800 mb-3" />
              <p className="text-zinc-600 text-sm">
                Switch to edit mode to start writing
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
