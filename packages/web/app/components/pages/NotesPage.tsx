import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { FileText, Plus, Trash2, Search, Pencil, Eye } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

export function NotesPage({ tab }: { tab: Doc<"sidebarTabs"> }) {
  const notes = useQuery(api.tabNotes.list, { tabId: tab._id });
  const createNote = useMutation(api.tabNotes.create);
  const updateNote = useMutation(api.tabNotes.update);
  const removeNote = useMutation(api.tabNotes.remove);
  const [selectedId, setSelectedId] = useState<Id<"tabNotes"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNaming, setIsNaming] = useState(false);
  const [newNoteName, setNewNoteName] = useState("");

  const searchResults = useQuery(
    api.tabNotes.search,
    searchQuery.trim()
      ? { tabId: tab._id, query: searchQuery.trim() }
      : "skip"
  );

  const displayNotes = searchQuery.trim() ? searchResults : notes;
  const selectedNote = notes?.find((n) => n._id === selectedId);

  function handleStartCreate() {
    setIsNaming(true);
    setNewNoteName("");
  }

  async function handleConfirmCreate() {
    const trimmed = newNoteName.trim();
    if (!trimmed) {
      setIsNaming(false);
      setNewNoteName("");
      return;
    }
    const id = await createNote({
      tabId: tab._id,
      title: trimmed,
    });
    setSelectedId(id);
    setIsNaming(false);
    setNewNoteName("");
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* Note List */}
      <div className="w-72 border-r border-rule flex flex-col shrink-0 bg-surface">
        <div className="px-4 py-3.5 border-b border-rule flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.5} />
            <span className="eyebrow">{tab.label}</span>
            {notes && (
              <span className="text-[10px] text-ink-faint tabular-nums">
                {notes.length}
              </span>
            )}
          </div>
          <button
            onClick={handleStartCreate}
            className="p-1.5 text-ink-faint hover:text-ink hover:bg-surface-sunken transition-colors"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-3 py-2.5 border-b border-rule shrink-0">
          <div className="relative">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" strokeWidth={1.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full bg-transparent border-0 border-b border-rule pl-6 pr-0 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isNaming && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmCreate();
              }}
              className="bg-surface-sunken border-b border-rule px-3.5 py-3"
            >
              <input
                value={newNoteName}
                onChange={(e) => setNewNoteName(e.target.value)}
                onBlur={() => {
                  setIsNaming(false);
                  setNewNoteName("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsNaming(false);
                    setNewNoteName("");
                  }
                }}
                placeholder="Note name…"
                className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder-ink-faint"
                autoFocus
              />
              <div className="text-[10px] text-ink-faint mt-1.5">
                Enter to create · Esc to cancel
              </div>
            </form>
          )}
          {displayNotes === undefined ? (
            <div className="space-y-px">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-surface-sunken animate-pulse"
                />
              ))}
            </div>
          ) : displayNotes.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center px-4">
              <FileText className="h-8 w-8 text-ink-faint mb-2" strokeWidth={1} />
              <p className="text-xs text-ink-faint">
                {searchQuery ? "No matches" : "No notes yet"}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleStartCreate}
                  className="mt-3 text-xs text-ink-muted hover:text-ink underline underline-offset-2 transition-colors"
                >
                  Create one
                </button>
              )}
            </div>
          ) : (
            <ol className="divide-y divide-rule">
              {displayNotes.map((note) => (
                <li key={note._id}>
                  <button
                    onClick={() => setSelectedId(note._id)}
                    className={`w-full text-left px-3.5 py-3 transition-all ${
                      selectedId === note._id
                        ? "bg-surface-sunken"
                        : "hover:bg-surface-sunken/60"
                    }`}
                  >
                    <div className="text-sm font-medium text-ink truncate">
                      {note.title}
                    </div>
                    <div className="text-[11px] text-ink-faint line-clamp-2 mt-0.5 leading-relaxed">
                      {note.content.substring(0, 80) || "Empty note"}
                    </div>
                    <div className="text-[9px] text-ink-faint mt-1">
                      {new Date(note._creationTime).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Note Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedNote ? (
          <NoteEditor
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
            <FileText className="h-10 w-10 text-ink-faint mb-3" strokeWidth={1} />
            <p className="text-ink-muted font-medium text-sm">No note selected</p>
            <p className="text-xs text-ink-faint mt-1">
              Select a note or create a new one
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteEditor({
  note,
  onUpdate,
  onDelete,
}: {
  note: Doc<"tabNotes">;
  onUpdate: (updates: { title?: string; content?: string }) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [localTitle, setLocalTitle] = useState(note.title);
  const [localContent, setLocalContent] = useState(note.content);
  const titleTimer = useRef<ReturnType<typeof setTimeout>>();
  const contentTimer = useRef<ReturnType<typeof setTimeout>>();
  const isTitleFocused = useRef(false);
  const isContentFocused = useRef(false);

  // Sync from server only when not actively editing
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

  // Cleanup timers
  useEffect(() => {
    return () => {
      clearTimeout(titleTimer.current);
      clearTimeout(contentTimer.current);
    };
  }, []);

  function handleTitleChange(value: string) {
    setLocalTitle(value);
    clearTimeout(titleTimer.current);
    if (value.trim()) {
      titleTimer.current = setTimeout(() => {
        onUpdate({ title: value.trim() });
      }, 500);
    }
  }

  function handleContentChange(value: string) {
    setLocalContent(value);
    clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => {
      onUpdate({ content: value });
    }, 500);
  }

  function handleTitleBlur() {
    isTitleFocused.current = false;
    clearTimeout(titleTimer.current);
    if (!localTitle.trim()) {
      setLocalTitle(note.title);
    } else if (localTitle.trim() !== note.title) {
      onUpdate({ title: localTitle.trim() });
    }
  }

  function handleContentBlur() {
    isContentFocused.current = false;
    clearTimeout(contentTimer.current);
    if (localContent !== note.content) onUpdate({ content: localContent });
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
              className="cursor-pointer h-4 w-4 align-middle mr-1"
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
      <div className="border-b border-rule px-6 py-3.5 flex items-center justify-between shrink-0">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          onFocus={() => (isTitleFocused.current = true)}
          onBlur={handleTitleBlur}
          className="bg-transparent text-base font-semibold text-ink focus:outline-none flex-1 min-w-0"
          placeholder="Note title…"
        />

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mode toggle */}
          <div className="flex items-center border border-rule">
            <button
              onClick={() => setMode("edit")}
              className={`p-1.5 transition-colors ${
                mode === "edit"
                  ? "bg-surface-sunken text-ink"
                  : "text-ink-faint hover:text-ink-muted"
              }`}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`p-1.5 transition-colors ${
                mode === "preview"
                  ? "bg-surface-sunken text-ink"
                  : "text-ink-faint hover:text-ink-muted"
              }`}
              title="Preview"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-2 text-ink-faint hover:text-danger hover:bg-danger/5 transition-all ml-1"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      {mode === "edit" ? (
        <textarea
          value={localContent}
          onChange={(e) => handleContentChange(e.target.value)}
          onFocus={() => (isContentFocused.current = true)}
          onBlur={handleContentBlur}
          placeholder="Start writing… (supports markdown)"
          className="flex-1 bg-transparent px-6 py-5 text-sm text-ink placeholder:text-ink-faint focus:outline-none resize-none font-mono leading-relaxed"
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {localContent ? (
            <div className="max-w-2xl mx-auto prose prose-sm prose-headings:font-display prose-headings:text-ink prose-p:text-ink-muted prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-code:text-accent prose-code:bg-surface-sunken prose-code:px-1.5 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-surface-sunken prose-pre:border prose-pre:border-rule prose-blockquote:border-l-2 prose-blockquote:border-rule prose-blockquote:text-ink-muted prose-hr:border-rule prose-th:text-ink prose-th:bg-surface-sunken prose-td:text-ink-muted">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {localContent}
              </Markdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Pencil className="h-8 w-8 text-ink-faint mb-3" strokeWidth={1} />
              <p className="text-ink-faint text-sm">
                Switch to edit mode to start writing
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
