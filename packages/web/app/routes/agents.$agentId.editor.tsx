import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useNavigate, useParams } from "react-router";
import { useState, useEffect, useRef } from "react";
import { ChatMessageList } from "~/components/ChatMessageList";
import { ChatInput } from "~/components/ChatInput";
import {
  Bot,
  ChevronLeft,
  Pencil,
  Loader2,
  History,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  X,
} from "lucide-react";
import { Link } from "react-router";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import { getToolSetLabelsMap } from "@agent-maker/shared/src/tool-set-registry";

const TOOL_LABELS = getToolSetLabelsMap();

export default function AgentEditorPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const startEdit = useMutation(api.creatorSessions.startEdit);
  const abandonSession = useMutation(api.creatorSessions.abandon);

  const [sessionData, setSessionData] = useState<{
    sessionId: Id<"creatorSessions">;
    agentId: Id<"agents">;
    conversationId: Id<"conversations">;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !agentId) return;
    startedRef.current = true;
    setStarting(true);
    startEdit({ agentId: agentId as Id<"agents"> })
      .then((data) => setSessionData(data as any))
      .catch((err) => {
        alert(err.message);
        navigate(`/agents/${agentId}/settings`);
      })
      .finally(() => setStarting(false));
  }, [agentId]);

  if (!sessionData) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-faint mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-muted">Starting the agent editor…</p>
        </div>
      </div>
    );
  }

  return (
    <EditorView
      sessionId={sessionData.sessionId}
      agentId={sessionData.agentId}
      conversationId={sessionData.conversationId}
      onDone={() => navigate(`/agents/${agentId}`)}
      onAbandon={async () => {
        await abandonSession({ sessionId: sessionData.sessionId });
        navigate(`/agents/${agentId}/settings`);
      }}
    />
  );
}

function EditorView({
  sessionId,
  agentId,
  conversationId,
  onDone,
  onAbandon,
}: {
  sessionId: Id<"creatorSessions">;
  agentId: Id<"agents">;
  conversationId: Id<"conversations">;
  onDone: () => void;
  onAbandon: () => void;
}) {
  const navigate = useNavigate();
  const session = useQuery(api.creatorSessions.get, { sessionId });
  const agent = useQuery(api.agents.get, { agentId });
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const stopMessage = useMutation(api.messages.stop);
  const createConversation = useMutation(api.conversations.create);
  const pastSessions = useQuery(api.creatorSessions.listByAgent, { agentId });
  const [creatingChat, setCreatingChat] = useState(false);

  const [showHistory, setShowHistory] = useState(
    typeof window !== "undefined" && window.innerWidth >= 1024
  );
  const [viewingConversationId, setViewingConversationId] =
    useState<Id<"conversations"> | null>(null);

  useEffect(() => {
    if (session && session.status === "completed") {
      onDone();
    }
  }, [session?.status]);

  const hasActiveRun = messages?.some(
    (m) => m.status === "pending" || m.status === "processing"
  );

  async function handleSend(content: string) {
    try {
      await sendMessage({ conversationId, content });
    } catch (err: any) {
      console.error("Failed to send:", err);
    }
  }

  async function handleStop() {
    try {
      await stopMessage({ conversationId });
    } catch (err: any) {
      console.error("Failed to stop:", err);
    }
  }

  async function handleNewChat() {
    setCreatingChat(true);
    try {
      const convId = await createConversation({ agentId });
      navigate(`/agents/${agentId}/chat/${convId}`);
    } catch (err: any) {
      console.error("Failed to create chat:", err);
    } finally {
      setCreatingChat(false);
    }
  }

  const config = (session?.partialConfig as any) ?? {};

  return (
    <div className="flex h-screen bg-surface">
      {/* Left: Edit History Sidebar */}
      {showHistory && (
        <EditHistorySidebar
          sessions={pastSessions ?? []}
          currentSessionId={sessionId}
          viewingConversationId={viewingConversationId}
          onSelectSession={(convId) => setViewingConversationId(convId)}
          onClose={() => {
            setShowHistory(false);
            setViewingConversationId(null);
          }}
        />
      )}

      {/* History viewer overlay (read-only past conversation) */}
      {viewingConversationId && (
        <PastConversationViewer
          conversationId={viewingConversationId}
          onClose={() => setViewingConversationId(null)}
        />
      )}

      {/* Center: Chat */}
      <div className={`flex-1 flex flex-col min-w-0 ${viewingConversationId ? "hidden" : ""}`}>
        {/* Header */}
        <div className="border-b border-rule px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link
              to={`/agents/${agentId}/settings`}
              className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted transition-colors"
            >
              <ChevronLeft className="h-3 w-3" strokeWidth={1.75} />
              Settings
            </Link>
            <div className="h-4 w-px bg-rule" />
            <div className="flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
              <span className="text-sm text-ink">
                Editing{agent ? `: ${agent.name}` : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewChat}
              disabled={creatingChat}
              className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink transition-colors disabled:opacity-40"
            >
              {creatingChat ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
              ) : (
                <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
              )}
              New Chat
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold transition-colors ${
                showHistory ? "text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <History className="h-3 w-3" strokeWidth={1.5} />
              History
              {pastSessions && pastSessions.length > 0 && (
                <span className="font-mono text-ink-faint">
                  {pastSessions.length}
                </span>
              )}
            </button>
            <button
              onClick={onAbandon}
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Messages */}
        {messages === undefined ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-ink-faint" strokeWidth={1.5} />
          </div>
        ) : (
          <ChatMessageList messages={messages} onSendSuggestion={handleSend} />
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          isProcessing={hasActiveRun ?? false}
          hasActiveQuestions={(() => {
            const last = messages?.[messages.length - 1];
            return !!(last?.role === "assistant" && last?.status === "done" && last?.questions?.length);
          })()}
        />
      </div>

      {/* Right: Config Preview */}
      {!viewingConversationId && (
        <aside className="w-80 border-l border-rule flex flex-col shrink-0 bg-surface">
          <div className="px-5 h-14 border-b border-rule flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.5} />
            <p className="eyebrow">Preview</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
            {/* Icon */}
            {config.iconUrl && (
              <div>
                <p className="eyebrow mb-2">Icon</p>
                <img
                  src={config.iconUrl}
                  alt="Agent icon"
                  className="h-12 w-12 object-cover border border-rule"
                />
              </div>
            )}

            <ConfigField label="Name" value={config.name} />
            <ConfigField label="Description" value={config.description} />
            <ConfigField label="Model" value={config.model} />

            <div>
              <p className="eyebrow mb-2">Capabilities</p>
              {(config.enabledToolSets ?? []).length > 0 ? (
                <p className="text-sm text-ink leading-relaxed">
                  {(config.enabledToolSets as string[]).map((t: string, i: number) => (
                    <span key={t}>
                      {i > 0 && <span className="text-ink-faint"> &middot; </span>}
                      {TOOL_LABELS[t] ?? t}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-sm text-ink-faint italic">Not set</p>
              )}
            </div>

            {config.pages && config.pages.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Pages</p>
                <p className="text-sm text-ink leading-relaxed">
                  {config.pages.map((p: any, i: number) => (
                    <span key={p.label}>
                      {i > 0 && <span className="text-ink-faint"> &middot; </span>}
                      {p.label}
                    </span>
                  ))}
                </p>
              </div>
            )}

            <div>
              <p className="eyebrow mb-2">System Prompt</p>
              {config.systemPrompt &&
              config.systemPrompt !== "You are a helpful AI assistant." ? (
                <pre className="font-mono text-2xs text-ink-muted whitespace-pre-wrap bg-surface-sunken border border-rule p-3 max-h-64 overflow-y-auto leading-relaxed">
                  {config.systemPrompt}
                </pre>
              ) : (
                <p className="text-sm text-ink-faint italic">Not set</p>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

// ── Edit History Sidebar ──────────────────────────────────────────────

type SessionSummary = {
  _id: Id<"creatorSessions">;
  _creationTime: number;
  status: string;
  mode?: string;
  conversationId?: Id<"conversations">;
  messageCount: number;
  preview: string;
};

function EditHistorySidebar({
  sessions,
  currentSessionId,
  viewingConversationId,
  onSelectSession,
  onClose,
}: {
  sessions: SessionSummary[];
  currentSessionId: Id<"creatorSessions">;
  viewingConversationId: Id<"conversations"> | null;
  onSelectSession: (conversationId: Id<"conversations">) => void;
  onClose: () => void;
}) {
  function formatDate(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="w-72 border-r border-rule flex flex-col shrink-0 bg-surface">
      <div className="px-5 h-14 border-b border-rule flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.5} />
          <p className="eyebrow">Edit History</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-ink-faint hover:text-ink transition-colors"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="px-5 py-8">
            <p className="eyebrow">Empty</p>
            <p className="mt-2 text-sm text-ink-faint">No previous edit sessions.</p>
          </div>
        ) : (
          <ol className="divide-y divide-rule">
            {sessions.map((s) => {
              const isViewing = viewingConversationId === s.conversationId;
              return (
                <li key={s._id}>
                  <button
                    onClick={() =>
                      s.conversationId && onSelectSession(s.conversationId)
                    }
                    disabled={!s.conversationId}
                    className={`w-full text-left px-5 py-3.5 transition-colors ${
                      isViewing ? "bg-surface-sunken" : "hover:bg-surface-sunken/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {s.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3 text-accent shrink-0" strokeWidth={1.5} />
                      ) : s.status === "abandoned" ? (
                        <XCircle className="h-3 w-3 text-ink-faint shrink-0" strokeWidth={1.5} />
                      ) : (
                        <Clock className="h-3 w-3 text-warn shrink-0" strokeWidth={1.5} />
                      )}
                      <span className="font-mono text-2xs text-ink-faint">
                        {formatDate(s._creationTime)}
                      </span>
                      <span className="font-mono text-2xs text-ink-faint ml-auto">
                        {s.messageCount} msgs
                      </span>
                    </div>
                    <p className="text-xs text-ink truncate leading-snug">
                      {s.preview}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-2xs uppercase tracking-[0.1em] font-semibold ${
                          s.status === "completed"
                            ? "text-accent"
                            : s.status === "abandoned"
                              ? "text-ink-faint"
                              : "text-warn"
                        }`}
                      >
                        {s.status === "completed"
                          ? "Applied"
                          : s.status === "abandoned"
                            ? "Cancelled"
                            : "Active"}
                      </span>
                      {s.mode && (
                        <span className="text-2xs text-ink-faint uppercase tracking-[0.1em]">
                          {s.mode}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

// ── Past Conversation Viewer (read-only) ────────────────────────────────

function PastConversationViewer({
  conversationId,
  onClose,
}: {
  conversationId: Id<"conversations">;
  onClose: () => void;
}) {
  const messages = useQuery(api.messages.list, { conversationId });

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="border-b border-rule px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted transition-colors"
          >
            <ChevronLeft className="h-3 w-3" strokeWidth={1.75} />
            Back to editor
          </button>
          <div className="h-4 w-px bg-rule" />
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
            <span className="text-sm text-ink">Past Edit Session</span>
          </div>
        </div>
        <span className="eyebrow text-ink-faint">Read-only</span>
      </div>

      {messages === undefined ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-ink-faint" strokeWidth={1.5} />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-ink-faint">
          No messages found for this session.
        </div>
      ) : (
        <ChatMessageList messages={messages} />
      )}
    </div>
  );
}

function ConfigField({ label, value }: { label: string; value?: string }) {
  const empty = !value || value === "New Agent";
  return (
    <div>
      <p className="eyebrow mb-1">{label}</p>
      {empty ? (
        <p className="text-sm text-ink-faint italic">Not set</p>
      ) : (
        <p className="text-sm text-ink">{value}</p>
      )}
    </div>
  );
}
