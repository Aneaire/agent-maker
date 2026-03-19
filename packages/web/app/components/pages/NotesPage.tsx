import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { FileText, Plus, Trash2, Search } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";

export function NotesPage({ tab }: { tab: Doc<"sidebarTabs"> }) {
  const notes = useQuery(api.tabNotes.list, { tabId: tab._id });
  const createNote = useMutation(api.tabNotes.create);
  const updateNote = useMutation(api.tabNotes.update);
  const removeNote = useMutation(api.tabNotes.remove);
  const [selectedId, setSelectedId] = useState<Id<"tabNotes"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useQuery(
    api.tabNotes.search,
    searchQuery.trim()
      ? { tabId: tab._id, query: searchQuery.trim() }
      : "skip"
  );

  const displayNotes = searchQuery.trim() ? searchResults : notes;
  const selectedNote = notes?.find((n) => n._id === selectedId);

  async function handleCreate() {
    const id = await createNote({
      tabId: tab._id,
      title: "Untitled",
    });
    setSelectedId(id);
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* Note List */}
      <div className="w-72 border-r border-zinc-800/60 flex flex-col shrink-0 bg-zinc-950/50">
        <div className="px-4 py-4 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/80">
              <FileText className="h-3.5 w-3.5 text-zinc-300" />
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

        <div className="px-3 py-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus-glow transition-colors"
            />
          </div>
        </div>

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
                {searchQuery ? "No matches" : "No notes yet"}
              </p>
              {!searchQuery && (
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
                    ? "bg-zinc-800 text-zinc-100 shadow-sm border-l-2 border-neon-400 pl-3"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
              >
                <div className="text-sm font-medium truncate">
                  {note.title}
                </div>
                <div className="text-[11px] text-zinc-600 line-clamp-2 mt-1 leading-relaxed">
                  {note.content.substring(0, 80) || "Empty note"}
                </div>
                <div className="text-[9px] text-zinc-700 mt-1.5">
                  {new Date(note._creationTime).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Note Editor */}
      <div className="flex-1 flex flex-col">
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
            <FileText className="h-12 w-12 text-zinc-800 mb-3" />
            <p className="text-zinc-500 font-medium">No note selected</p>
            <p className="text-sm text-zinc-600 mt-1">
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
    titleTimer.current = setTimeout(() => {
      onUpdate({ title: value });
    }, 500);
  }

  function handleContentChange(value: string) {
    setLocalContent(value);
    clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => {
      onUpdate({ content: value });
    }, 500);
  }

  // Flush pending changes on blur
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

  return (
    <>
      <div className="border-b border-zinc-800/60 px-6 py-3.5 flex items-center justify-between shrink-0">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          onFocus={() => (isTitleFocused.current = true)}
          onBlur={handleTitleBlur}
          className="bg-transparent text-base font-semibold text-zinc-100 focus:outline-none flex-1"
          placeholder="Note title..."
        />
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={localContent}
        onChange={(e) => handleContentChange(e.target.value)}
        onFocus={() => (isContentFocused.current = true)}
        onBlur={handleContentBlur}
        placeholder="Start writing..."
        className="flex-1 bg-transparent px-6 py-5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none resize-none font-mono leading-relaxed"
      />
    </>
  );
}
