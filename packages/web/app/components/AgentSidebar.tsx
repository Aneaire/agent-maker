import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { Link, useParams, useNavigate, useLocation } from "react-router";
import {
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
  X,
  Pencil,
  Trash2,
  Check,
  ImageIcon,
  GitBranch,
  Lock,
  Hash,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import { PLAN_LIMITS } from "@agent-maker/shared/src/types";

const TAB_ICONS: Record<string, React.ReactNode> = {
  tasks: <CheckSquare className="h-3.5 w-3.5" strokeWidth={1.5} />,
  notes: <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />,
  spreadsheet: <Table className="h-3.5 w-3.5" strokeWidth={1.5} />,
  markdown: <Type className="h-3.5 w-3.5" strokeWidth={1.5} />,
  postgres: <Database className="h-3.5 w-3.5" strokeWidth={1.5} />,
  api: <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />,
  workflow: <GitBranch className="h-3.5 w-3.5" strokeWidth={1.5} />,
};

const PAGE_TYPES = [
  { type: "tasks" as const, label: "Tasks", description: "Kanban board", icon: CheckSquare },
  { type: "notes" as const, label: "Notes", description: "Markdown notes", icon: FileText },
  { type: "spreadsheet" as const, label: "Spreadsheet", description: "Data table", icon: Table },
  { type: "api" as const, label: "REST API", description: "Expose agent as API", icon: Globe },
  { type: "workflow" as const, label: "Workflow", description: "Automations & schedules", icon: GitBranch },
];

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

/* ── shared nav item helpers ─────────────────────────────────────────── */
const navRowBase =
  "group relative flex items-center gap-2.5 text-sm transition-colors";
function navRowClass(isActive: boolean) {
  return `${navRowBase} ${
    isActive
      ? "bg-surface-sunken text-ink"
      : "text-ink-muted hover:text-ink hover:bg-surface-sunken/60"
  }`;
}

export function AgentSidebar({ agent }: { agent: Doc<"agents"> }) {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const conversations = useQuery(api.conversations.list, {
    agentId: agent._id,
  });
  const slackConversations = useQuery(api.conversations.listSlackConversationsForAgent, {
    agentId: agent._id,
  });
  const tabs = useQuery(api.sidebarTabs.list, { agentId: agent._id });
  const user = useQuery(api.users.me);
  const updateTitle = useMutation(api.conversations.updateTitle);
  const removeConversation = useMutation(api.conversations.remove);
  const createTab = useMutation(api.sidebarTabs.create);
  const updateTab = useMutation(api.sidebarTabs.update);
  const removeTab = useMutation(api.sidebarTabs.remove);
  const [showAddPage, setShowAddPage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTabId, setDeleteTabId] = useState<string | null>(null);
  const [deleteTabConfirm, setDeleteTabConfirm] = useState("");
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renamingTabLabel, setRenamingTabLabel] = useState("");
  const [slackSectionOpen, setSlackSectionOpen] = useState(true);
  const [expandedSlackChannels, setExpandedSlackChannels] = useState<Set<string>>(new Set());
  const editInputRef = useRef<HTMLInputElement>(null);
  const tabRenameInputRef = useRef<HTMLInputElement>(null);

  const slackConversationIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of slackConversations ?? []) set.add(s.conversationId as string);
    return set;
  }, [slackConversations]);

  const conversationGroups = useMemo(() => {
    if (!conversations) return null;
    const filtered = conversations.filter(
      (c) => !slackConversationIds.has(c._id as string)
    );
    return groupConversationsByTime(filtered);
  }, [conversations, slackConversationIds]);

  const slackByChannel = useMemo(() => {
    if (!slackConversations) return null;
    const map = new Map<
      string,
      {
        channelId: string;
        channelType: "channel" | "im";
        label: string;
        threads: typeof slackConversations;
      }
    >();
    for (const s of slackConversations) {
      const key = s.slackChannelId;
      if (!map.has(key)) {
        const label =
          s.channelType === "im"
            ? `DM · ${s.lastMentionerUserName ?? s.lastMentionerUserId ?? s.slackChannelId}`
            : s.slackChannelName ?? s.slackChannelId;
        map.set(key, {
          channelId: s.slackChannelId,
          channelType: s.channelType,
          label,
          threads: [],
        });
      }
      map.get(key)!.threads.push(s);
    }
    return Array.from(map.values());
  }, [slackConversations]);

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

  function handleNewChat() {
    navigate(`/agents/${agent._id}/chat/new`);
  }

  async function handleAddPage(type: string, label: string) {
    const tabId = await createTab({
      agentId: agent._id,
      label,
      type: type as any,
    });
    setShowAddPage(false);
    navigate(`/agents/${agent._id}/tab/${tabId}`);
    setRenamingTabId(tabId);
    setRenamingTabLabel("");
  }

  async function handleTabRenameSubmit(tabId: string, fallbackLabel: string) {
    const trimmed = renamingTabLabel.trim();
    if (trimmed && trimmed !== fallbackLabel) {
      await updateTab({ tabId: tabId as any, label: trimmed });
    }
    setRenamingTabId(null);
    setRenamingTabLabel("");
  }

  const settingsActive = location.pathname === `/agents/${agent._id}/settings`;
  const memoriesActive = location.pathname.endsWith("/memories");
  const assetsActive = location.pathname.includes("/assets");

  return (
    <aside className="w-64 border-r border-rule flex flex-col bg-surface shrink-0">
      {/* ── Agent header ──────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4 border-b border-rule">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted transition-colors group mb-3"
        >
          <ChevronLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </Link>
        <div className="flex items-start gap-3">
          {agent.iconUrl ? (
            <img
              src={agent.iconUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-sm bg-surface-sunken" />
          )}
          <div className="min-w-0 pt-0.5">
            <div className="font-display text-base leading-tight text-ink truncate">
              {agent.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  agent.status === "active"
                    ? "bg-accent"
                    : agent.status === "paused"
                      ? "bg-warn"
                      : "bg-rule-strong"
                }`}
              />
              <span className="font-mono text-2xs text-ink-faint truncate">
                {agent.model}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Primary nav ────────────────────────────────────────────── */}
      <nav className="py-2">
        <button
          onClick={handleNewChat}
          className="flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium text-ink-inverse bg-ink hover:bg-ink-muted transition-colors mx-3 my-1.5 rounded-sm"
          style={{ width: "calc(100% - 1.5rem)" }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New chat
        </button>

        <Link
          to={`/agents/${agent._id}/memories`}
          className={`${navRowClass(memoriesActive)} px-4 py-2`}
        >
          <Brain className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          Memories
        </Link>
        <Link
          to={`/agents/${agent._id}/assets`}
          className={`${navRowClass(assetsActive)} px-4 py-2`}
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          Assets
        </Link>
      </nav>

      {/* ── Pages ──────────────────────────────────────────────────── */}
      {tabs === undefined ? (
        <div className="pb-1">
          <div className="eyebrow px-4 py-2">Pages</div>
          {[{ w: "w-28" }, { w: "w-32" }, { w: "w-24" }].map(({ w }, i) => (
            <div key={i} className="flex items-center gap-2.5 px-4 py-2">
              {/* tab icon: h-3.5 w-3.5 */}
              <div className="h-3.5 w-3.5 shrink-0 bg-surface-sunken animate-pulse" />
              {/* label: text-sm → h-5 */}
              <div className={`h-5 ${w} bg-surface-sunken animate-pulse`} />
            </div>
          ))}
        </div>
      ) : tabs.length > 0 ? (
        <div className="pb-1">
          <div className="eyebrow px-4 py-2">Pages</div>
          {tabs.map((tab) => {
            const isActive = location.pathname.includes(`/tab/${tab._id}`);
            const isRenaming = renamingTabId === tab._id;
            return (
              <div key={tab._id} className={navRowClass(isActive)}>
                {isRenaming ? (
                  <form
                    className="flex items-center gap-2.5 flex-1 px-4 py-2 min-w-0"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleTabRenameSubmit(tab._id, tab.label);
                    }}
                  >
                    {TAB_ICONS[tab.type] ?? <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    <input
                      ref={tabRenameInputRef}
                      value={renamingTabLabel}
                      onChange={(e) => setRenamingTabLabel(e.target.value)}
                      onBlur={() => handleTabRenameSubmit(tab._id, tab.label)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setRenamingTabId(null);
                          setRenamingTabLabel("");
                        }
                      }}
                      placeholder={tab.label}
                      className="flex-1 bg-transparent border-b border-rule-strong text-sm text-ink outline-none min-w-0 placeholder:text-ink-faint"
                      autoFocus
                    />
                    <button
                      type="submit"
                      onMouseDown={(e) => e.preventDefault()}
                      className="p-0.5 text-ink-faint hover:text-accent"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </form>
                ) : (
                  <>
                    <Link
                      to={`/agents/${agent._id}/tab/${tab._id}`}
                      className="flex items-center gap-2.5 flex-1 px-4 py-2 min-w-0"
                    >
                      {TAB_ICONS[tab.type] ?? <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />}
                      <span className="truncate">{tab.label}</span>
                    </Link>
                    <div className="hidden group-hover:flex items-center gap-0.5 pr-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setRenamingTabId(tab._id);
                          setRenamingTabLabel(tab.label);
                        }}
                        className="p-1 text-ink-faint hover:text-ink transition-colors"
                      >
                        <Pencil className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setDeleteTabId(tab._id);
                          setDeleteTabConfirm("");
                        }}
                        className="p-1 text-ink-faint hover:text-danger transition-colors"
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Add page ───────────────────────────────────────────────── */}
      <div className="px-4 pb-2 relative">
        <button
          onClick={() => setShowAddPage(!showAddPage)}
          className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted transition-colors"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Add page
        </button>
        {showAddPage && (
          <div className="absolute left-3 right-3 mt-2 bg-surface-raised border border-rule rounded-md shadow-xl shadow-surface-inverse/10 z-10 rise">
            <div className="flex items-center justify-between px-3 py-2 border-b border-rule">
              <span className="eyebrow">Add a page</span>
              <button
                onClick={() => setShowAddPage(false)}
                className="p-0.5 text-ink-faint hover:text-ink"
              >
                <X className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
            <div className="py-1">
              {availablePageTypes.map((pt) => {
                const Icon = pt.icon;
                return (
                  <button
                    key={pt.type}
                    onClick={() => !pt.locked && handleAddPage(pt.type, pt.label)}
                    disabled={pt.locked}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                      pt.locked
                        ? "text-ink-faint cursor-not-allowed"
                        : "text-ink hover:bg-surface-sunken"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        pt.locked ? "text-ink-faint" : "text-ink-muted"
                      }`}
                      strokeWidth={1.5}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-tight font-medium flex items-center gap-1.5">
                        {pt.label}
                        {pt.locked && (
                          <Lock className="h-3 w-3 text-warn" strokeWidth={1.5} />
                        )}
                      </div>
                      <div
                        className={`mt-0.5 text-2xs leading-snug ${
                          pt.locked ? "text-ink-faint" : "text-ink-faint"
                        }`}
                      >
                        {pt.description}
                        {pt.locked && " · Pro"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Slack threads ──────────────────────────────────────────── */}
      {slackByChannel && slackByChannel.length > 0 && (
        <div className="pb-2">
          <button
            onClick={() => setSlackSectionOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 px-4 py-2 eyebrow hover:text-ink-muted transition-colors"
          >
            {slackSectionOpen ? (
              <ChevronDown className="h-3 w-3" strokeWidth={2} />
            ) : (
              <ChevronRight className="h-3 w-3" strokeWidth={2} />
            )}
            Slack threads
            <span className="ml-auto tabular-nums font-mono font-normal">
              {slackConversations?.length ?? 0}
            </span>
          </button>
          {slackSectionOpen && (
            <div>
              {slackByChannel.map((channel) => {
                const isExpanded = expandedSlackChannels.has(channel.channelId);
                return (
                  <div key={channel.channelId}>
                    <button
                      onClick={() => {
                        setExpandedSlackChannels((prev) => {
                          const next = new Set(prev);
                          if (next.has(channel.channelId)) next.delete(channel.channelId);
                          else next.add(channel.channelId);
                          return next;
                        });
                      }}
                      className="flex w-full items-center gap-2 px-4 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken/60 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0" strokeWidth={2} />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2} />
                      )}
                      {channel.channelType === "im" ? (
                        <MessageSquare className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={1.5} />
                      ) : (
                        <Hash className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={1.5} />
                      )}
                      <span className="truncate flex-1 text-left">{channel.label}</span>
                      <span className="text-2xs text-ink-faint tabular-nums font-mono">
                        {channel.threads.length}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="py-0.5">
                        {channel.threads.map((thread) => {
                          const isActive = conversationId === thread.conversationId;
                          const requester =
                            thread.lastMentionerUserName ??
                            thread.lastMentionerUserId ??
                            "user";
                          return (
                            <Link
                              key={thread._id}
                              to={`/agents/${agent._id}/chat/${thread.conversationId}`}
                              className={`${navRowClass(isActive)} px-4 py-1.5 text-sm pl-11`}
                            >
                              <MessageSquare className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={1.5} />
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{requester}</div>
                                {thread.mode === "bot" && (
                                  <div className="text-2xs text-ink-faint truncate">
                                    bot mode
                                  </div>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Conversations ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-2 min-h-0">
        <div className="eyebrow px-4 py-2">Conversations</div>
        {conversations === undefined ? (
          <div>
            {/* "Today" group label */}
            <div className="px-4 py-1.5">
              <div className="h-[9px] w-8 bg-surface-sunken animate-pulse" />
            </div>
            {[{ w: "w-32" }, { w: "w-28" }, { w: "w-36" }].map(({ w }, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2">
                <div className="h-3 w-3 shrink-0 bg-surface-sunken animate-pulse" />
                <div className={`h-5 ${w} bg-surface-sunken animate-pulse`} />
              </div>
            ))}
            {/* "Yesterday" group label */}
            <div className="px-4 py-1.5 mt-0.5">
              <div className="h-[9px] w-14 bg-surface-sunken animate-pulse" />
            </div>
            {[{ w: "w-24" }, { w: "w-40" }].map(({ w }, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2">
                <div className="h-3 w-3 shrink-0 bg-surface-sunken animate-pulse" />
                <div className={`h-5 ${w} bg-surface-sunken animate-pulse`} />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-ink-faint px-4 py-2">
            No conversations yet
          </p>
        ) : (
          <div>
            {conversationGroups?.map((group) => (
              <div key={group.label}>
                <div className="text-2xs text-ink-faint px-4 py-1.5 font-mono uppercase tracking-wider">
                  {group.label}
                </div>
                <div>
                  {group.items.map((conv) => {
                    const isEditing = editingId === conv._id;
                    const isActive = conversationId === conv._id;
                    return (
                      <div key={conv._id} className={navRowClass(isActive)}>
                        {isEditing ? (
                          <form
                            className="flex items-center gap-2 flex-1 px-4 py-2"
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
                            <MessageSquare className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={1.5} />
                            <input
                              ref={editInputRef}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => setEditingId(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="flex-1 bg-transparent border-b border-rule-strong text-sm text-ink outline-none min-w-0"
                              autoFocus
                            />
                            <button
                              type="submit"
                              onMouseDown={(e) => e.preventDefault()}
                              className="p-0.5 text-ink-faint hover:text-accent"
                            >
                              <Check className="h-3 w-3" strokeWidth={1.5} />
                            </button>
                          </form>
                        ) : (
                          <>
                            <Link
                              to={`/agents/${agent._id}/chat/${conv._id}`}
                              className="flex items-center gap-2.5 flex-1 px-4 py-2 min-w-0"
                            >
                              <MessageSquare className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={1.5} />
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
                                className="p-1 text-ink-faint hover:text-ink transition-colors"
                              >
                                <Pencil className="h-3 w-3" strokeWidth={1.5} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setDeleteId(conv._id);
                                }}
                                className="p-1 text-ink-faint hover:text-danger transition-colors"
                              >
                                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
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

      {/* ── Footer: settings ───────────────────────────────────────── */}
      <div className="border-t border-rule py-1">
        <Link
          to={`/agents/${agent._id}/settings`}
          className={`${navRowClass(settingsActive)} px-4 py-2.5`}
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={1.5} />
          Settings
        </Link>
      </div>

      {/* ── Delete conversation confirm ────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/40 backdrop-blur-[2px]">
          <div className="w-80 bg-surface-raised border border-rule rounded-md p-6 rise">
            <p className="eyebrow">Delete conversation</p>
            <h3 className="mt-2 font-display text-lg leading-tight text-ink">
              Remove this thread?
            </h3>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">
              This permanently deletes the conversation and all its messages.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="text-sm text-ink-muted hover:text-ink px-3 py-1.5 transition-colors"
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
                className="text-sm font-medium text-danger hover:bg-danger-soft px-3 py-1.5 rounded-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete page confirm ────────────────────────────────────── */}
      {deleteTabId && (() => {
        const tabToDelete = tabs?.find((t) => t._id === deleteTabId);
        if (!tabToDelete) return null;
        const confirmMatch = deleteTabConfirm === tabToDelete.label;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/40 backdrop-blur-[2px]">
            <div className="w-96 bg-surface-raised border border-rule rounded-md p-6 rise">
              <p className="eyebrow">Delete page</p>
              <h3 className="mt-2 font-display text-lg leading-tight text-ink">
                Remove {tabToDelete.label}?
              </h3>
              <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                This permanently deletes the page and all its data.
              </p>
              <p className="mt-4 text-sm text-ink-muted">
                Type{" "}
                <span className="font-mono text-ink bg-surface-sunken px-1.5 py-0.5 rounded-xs">
                  {tabToDelete.label}
                </span>{" "}
                to confirm:
              </p>
              <input
                value={deleteTabConfirm}
                onChange={(e) => setDeleteTabConfirm(e.target.value)}
                placeholder={tabToDelete.label}
                className="mt-3 w-full bg-transparent border-0 border-b border-rule-strong px-0 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-danger focus:outline-none"
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
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setDeleteTabId(null);
                    setDeleteTabConfirm("");
                  }}
                  className="text-sm text-ink-muted hover:text-ink px-3 py-1.5 transition-colors"
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
                  className="text-sm font-medium text-danger hover:bg-danger-soft px-3 py-1.5 rounded-sm transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
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
