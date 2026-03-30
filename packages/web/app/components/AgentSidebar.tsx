import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { Link, useParams, useNavigate, useLocation } from "react-router";
import {
  Bot,
  MessageSquare,
  Brain,
  Settings,
  Plus,
  ChevronLeft,
  CheckSquare,
  FileText,
  Table,
  Type,
  Database,
  LayoutGrid,
  Globe,
  Sparkles,
  X,
  Pencil,
  Trash2,
  Check,
  ImageIcon,
  GitBranch,
  Lock,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import { PLAN_LIMITS } from "@agent-maker/shared/src/types";

const TAB_ICONS: Record<string, React.ReactNode> = {
  tasks: <CheckSquare className="h-4 w-4" />,
  notes: <FileText className="h-4 w-4" />,
  spreadsheet: <Table className="h-4 w-4" />,
  markdown: <Type className="h-4 w-4" />,
  postgres: <Database className="h-4 w-4" />,
  api: <Globe className="h-4 w-4" />,
  workflow: <GitBranch className="h-4 w-4" />,
};

const PAGE_TYPES = [
  { type: "tasks" as const, label: "Tasks", description: "Kanban board", icon: CheckSquare },
  { type: "notes" as const, label: "Notes", description: "Markdown notes", icon: FileText },
  { type: "spreadsheet" as const, label: "Spreadsheet", description: "Data table", icon: Table },
  { type: "api" as const, label: "REST API", description: "Expose agent as API", icon: Globe },
  { type: "workflow" as const, label: "Workflow", description: "Automations & schedules", icon: GitBranch },
];

// Page types that can only be added once per agent
const SINGLETON_PAGE_TYPES = new Set(["workflow", "api"]);

function groupConversationsByTime(conversations: Doc<"conversations">[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;

  const groups: { label: string; items: Doc<"conversations">[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const conv of conversations) {
    const t = conv._creationTime;
    if (t >= todayStart) groups[0].items.push(conv);
    else if (t >= yesterdayStart) groups[1].items.push(conv);
    else groups[2].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function AgentSidebar({ agent }: { agent: Doc<"agents"> }) {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const conversations = useQuery(api.conversations.list, {
    agentId: agent._id,
  });
  const tabs = useQuery(api.sidebarTabs.list, { agentId: agent._id });
  const user = useQuery(api.users.me);
  const createConversation = useMutation(api.conversations.create);
  const updateTitle = useMutation(api.conversations.updateTitle);
  const removeConversation = useMutation(api.conversations.remove);
  const createTab = useMutation(api.sidebarTabs.create);
  const removeTab = useMutation(api.sidebarTabs.remove);
  const [showAddPage, setShowAddPage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTabId, setDeleteTabId] = useState<string | null>(null);
  const [deleteTabConfirm, setDeleteTabConfirm] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const conversationGroups = useMemo(
    () => (conversations ? groupConversationsByTime(conversations) : null),
    [conversations]
  );

  const plan = (user?.plan as "free" | "pro" | "enterprise") ?? "free";

  const availablePageTypes = useMemo(() => {
    const allowed = new Set(PLAN_LIMITS[plan].allowedPageTypes);
    const existingTypes = new Set(tabs?.map((t) => t.type) ?? []);
    return PAGE_TYPES.filter(
      (pt) => !SINGLETON_PAGE_TYPES.has(pt.type) || !existingTypes.has(pt.type)
    ).map((pt) => ({
      ...pt,
      locked: !allowed.has(pt.type),
    }));
  }, [tabs, plan]);

  async function handleNewChat() {
    const id = await createConversation({ agentId: agent._id });
    navigate(`/agents/${agent._id}/chat/${id}`);
  }

  async function handleAddPage(type: string, label: string) {
    const tabId = await createTab({
      agentId: agent._id,
      label,
      type: type as any,
    });
    setShowAddPage(false);
    navigate(`/agents/${agent._id}/tab/${tabId}`);
  }

  return (
    <aside className="w-64 border-r border-zinc-800/50 flex flex-col bg-gradient-to-b from-zinc-950 to-zinc-900/50 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors mb-3 group"
        >
          <ChevronLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </Link>
        <div className="flex items-center gap-3">
          {agent.iconUrl ? (
            <img src={agent.iconUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-zinc-800" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-zinc-700/50">
              <Bot className="h-5 w-5 text-zinc-400" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{agent.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  agent.status === "active"
                    ? "bg-neon-400 status-pulse"
                    : agent.status === "paused"
                      ? "bg-amber-400"
                      : "bg-zinc-600"
                }`}
              />
              <span className="text-xs text-zinc-500">{agent.model}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-2 space-y-0.5">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-950 bg-gradient-to-r from-neon-500 to-neon-400 hover:from-neon-400 hover:to-neon-300 transition-all group glow-neon-sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
        <Link
          to={`/agents/${agent._id}/memories`}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
            location.pathname.endsWith("/memories")
              ? "bg-neon-400/10 text-neon-400 shadow-sm border-l-2 border-neon-400 ml-0 pl-2.5"
              : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          }`}
        >
          <Brain className="h-4 w-4" />
          Memories
        </Link>
        <Link
          to={`/agents/${agent._id}/assets`}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
            location.pathname.includes("/assets")
              ? "bg-neon-400/10 text-neon-400 shadow-sm border-l-2 border-neon-400 ml-0 pl-2.5"
              : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Assets
        </Link>
      </nav>

      {/* Dynamic Pages */}
      {tabs && tabs.length > 0 && (
        <div className="px-2 pb-1">
          <div className="text-[10px] text-zinc-600 px-3 py-2 font-semibold uppercase tracking-widest">
            Pages
          </div>
          <div className="space-y-0.5">
            {tabs.map((tab) => {
              const isActive = location.pathname.includes(`/tab/${tab._id}`);
              return (
                <div
                  key={tab._id}
                  className={`group flex items-center rounded-xl text-sm transition-all ${
                    isActive
                      ? "bg-neon-400/10 text-neon-400 shadow-sm border-l-2 border-neon-400 ml-0 pl-0"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                  }`}
                >
                  <Link
                    to={`/agents/${agent._id}/tab/${tab._id}`}
                    className="flex items-center gap-2.5 flex-1 px-3 py-2 min-w-0"
                  >
                    {TAB_ICONS[tab.type] ?? <LayoutGrid className="h-4 w-4" />}
                    <span className="truncate">{tab.label}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setDeleteTabId(tab._id);
                      setDeleteTabConfirm("");
                    }}
                    className="hidden group-hover:block pr-2"
                  >
                    <Trash2 className="h-3 w-3 text-zinc-600 hover:text-red-400 transition-colors" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Page */}
      <div className="px-2 pb-1 relative">
        <button
          onClick={() => setShowAddPage(!showAddPage)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-900 hover:text-zinc-400 transition-all"
        >
          <Plus className="h-3 w-3" />
          Add Page
        </button>
        {showAddPage && (
          <div className="absolute left-2 right-2 mt-1 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/40 z-10">
            <div className="flex items-center justify-between px-2.5 py-1.5 mb-1">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Add a page
              </span>
              <button
                onClick={() => setShowAddPage(false)}
                className="p-0.5 rounded text-zinc-600 hover:text-zinc-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {availablePageTypes.map((pt) => {
              const Icon = pt.icon;
              return (
                <button
                  key={pt.type}
                  onClick={() => !pt.locked && handleAddPage(pt.type, pt.label)}
                  disabled={pt.locked}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors group ${
                    pt.locked
                      ? "text-zinc-600 cursor-not-allowed"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    pt.locked
                      ? "bg-zinc-800/50"
                      : "bg-zinc-800 group-hover:bg-zinc-700"
                  }`}>
                    <Icon className={`h-3.5 w-3.5 transition-colors ${
                      pt.locked
                        ? "text-zinc-700"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    }`} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium">{pt.label}</div>
                    <div className={`text-[10px] ${pt.locked ? "text-zinc-700" : "text-zinc-600"}`}>
                      {pt.description}
                    </div>
                  </div>
                  {pt.locked && (
                    <div className="flex items-center gap-1 text-[9px] font-semibold text-amber-500/70 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                      <Lock className="h-2.5 w-2.5" />
                      PRO
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="text-[10px] text-zinc-600 px-3 py-2 font-semibold uppercase tracking-widest">
          Conversations
        </div>
        {conversations === undefined ? (
          <div className="space-y-1.5 px-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 rounded-xl bg-zinc-900/50 animate-pulse"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-zinc-600 px-3 py-2">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-3">
            {conversationGroups?.map((group) => (
              <div key={group.label}>
                <div className="text-[9px] text-zinc-700 px-3 py-1 font-medium uppercase tracking-wider">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((conv) => {
                    const isEditing = editingId === conv._id;
                    const isActive = conversationId === conv._id;
                    return (
                      <div
                        key={conv._id}
                        className={`group flex items-center rounded-xl text-sm transition-all ${
                          isActive
                            ? "bg-zinc-800/80 text-zinc-100 shadow-sm border-l-2 border-neon-400 ml-0 pl-0"
                            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                        }`}
                      >
                        {isEditing ? (
                          <form
                            className="flex items-center gap-2 flex-1 px-3 py-2"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (editTitle.trim()) {
                                await updateTitle({
                                  conversationId: conv._id,
                                  title: editTitle.trim(),
                                });
                              }
                              setEditingId(null);
                            }}
                          >
                            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                            <input
                              ref={editInputRef}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => setEditingId(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="flex-1 bg-transparent border-b border-zinc-600 text-sm text-zinc-100 outline-none min-w-0"
                              autoFocus
                            />
                            <button
                              type="submit"
                              onMouseDown={(e) => e.preventDefault()}
                              className="p-0.5 text-zinc-500 hover:text-neon-400"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <Link
                              to={`/agents/${agent._id}/chat/${conv._id}`}
                              className="flex items-center gap-2.5 flex-1 px-3 py-2 min-w-0"
                            >
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                              <span className="truncate">
                                {conv.title || "New conversation"}
                              </span>
                            </Link>
                            <div className="hidden group-hover:flex items-center gap-0.5 pr-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditTitle(conv.title || "");
                                  setEditingId(conv._id);
                                }}
                                className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setDeleteId(conv._id);
                                }}
                                className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-700/50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-zinc-800/50">
        <Link
          to={`/agents/${agent._id}/settings`}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
            location.pathname === `/agents/${agent._id}/settings`
              ? "bg-neon-400/10 text-neon-400 shadow-sm border-l-2 border-neon-400 ml-0 pl-2.5"
              : "text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300"
          }`}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl fade-in-up">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2">
              Delete conversation
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              This will permanently delete this conversation and all its
              messages. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-400 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeConversation({
                    conversationId: deleteId as any,
                  });
                  if (conversationId === deleteId) {
                    navigate(`/agents/${agent._id}`);
                  }
                  setDeleteId(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Page Confirmation Dialog */}
      {deleteTabId && (() => {
        const tabToDelete = tabs?.find((t) => t._id === deleteTabId);
        if (!tabToDelete) return null;
        const confirmMatch = deleteTabConfirm === tabToDelete.label;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-80 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl fade-in-up">
              <h3 className="text-sm font-semibold text-zinc-100 mb-2">
                Delete page
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                This will permanently delete <span className="font-semibold text-zinc-200">{tabToDelete.label}</span> and all its data. This action cannot be undone.
              </p>
              <p className="text-xs text-zinc-500 mb-2">
                Type <span className="font-mono text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded">{tabToDelete.label}</span> to confirm:
              </p>
              <input
                value={deleteTabConfirm}
                onChange={(e) => setDeleteTabConfirm(e.target.value)}
                placeholder={tabToDelete.label}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-red-500/50 focus:outline-none transition-colors mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setDeleteTabId(null);
                    setDeleteTabConfirm("");
                  }
                  if (e.key === "Enter" && confirmMatch) {
                    e.preventDefault();
                    (async () => {
                      await removeTab({ tabId: deleteTabId as any });
                      if (location.pathname.includes(`/tab/${deleteTabId}`)) {
                        navigate(`/agents/${agent._id}`);
                      }
                      setDeleteTabId(null);
                      setDeleteTabConfirm("");
                    })();
                  }
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setDeleteTabId(null);
                    setDeleteTabConfirm("");
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-400 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!confirmMatch}
                  onClick={async () => {
                    await removeTab({ tabId: deleteTabId as any });
                    if (location.pathname.includes(`/tab/${deleteTabId}`)) {
                      navigate(`/agents/${agent._id}`);
                    }
                    setDeleteTabId(null);
                    setDeleteTabConfirm("");
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </aside>
  );
}
