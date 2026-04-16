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
  Maximize2,
} from "lucide-react";
import { Link } from "react-router";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import { getToolSetLabelsMap } from "@agent-maker/shared/src/tool-set-registry";
import { CHAT_MODELS, getProviderIcon } from "~/components/ModelDropdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const TOOL_LABELS = getToolSetLabelsMap();

const PROVIDER_TO_CRED: Record<string, string> = {
  Claude: "anthropic",
  Gemini: "google_ai",
  OpenAI: "openai",
};

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

  async function handleStartSession() {
    setStarting(true);
    setSessionData(null);
    try {
      const data = await startEdit({ agentId: agentId as Id<"agents"> });
      setSessionData(data as any);
    } catch (err: any) {
      alert(err.message);
      navigate(`/agents/${agentId}/settings`);
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (startedRef.current || !agentId) return;
    startedRef.current = true;
    handleStartSession();
  }, [agentId]);

  if (!sessionData) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-faint mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-muted">Starting the agent builder…</p>
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
      onNewChat={handleStartSession}
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
  onNewChat,
  onAbandon,
}: {
  sessionId: Id<"creatorSessions">;
  agentId: Id<"agents">;
  conversationId: Id<"conversations">;
  onDone: () => void;
  onNewChat: () => void;
  onAbandon: () => void;
}) {
  const navigate = useNavigate();
  const session = useQuery(api.creatorSessions.get, { sessionId });
  const agent = useQuery(api.agents.get, { agentId });
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const stopMessage = useMutation(api.messages.stop);
  const setCreatorModel = useMutation(api.creatorSessions.setCreatorModel);
  const aiProviders = useQuery(api.credentials.listAiProviders);
  const pastSessions = useQuery(api.creatorSessions.listByAgent, { agentId });

  const creatorModel = (session as any)?.creatorModel ?? "claude-sonnet-4-6";
  const enabledModels =
    aiProviders && aiProviders.length > 0
      ? CHAT_MODELS.filter((m) => {
          const cred = PROVIDER_TO_CRED[m.group];
          return cred ? aiProviders.includes(cred) : true;
        }).map((m) => m.value)
      : undefined;

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

  function handleNewChat() {
    onNewChat();
  }

  const config = (session?.partialConfig as any) ?? {};
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);

  function handlePromptSave() {
    if (editingPrompt === null) return;
    handleSend(`Please update the system prompt to:\n\n${editingPrompt}`);
    setEditingPrompt(null);
    setSystemPromptOpen(false);
  }

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
                Agent Builder{agent ? ` — ${agent.name}` : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
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
          model={creatorModel}
          onModelChange={(model) => setCreatorModel({ sessionId, model })}
          enabledModels={enabledModels}
          lockModelDuringProcessing={false}
        />
      </div>

      {/* Right: Config Preview */}
      {!viewingConversationId && (
        <aside className="w-80 border-l border-rule flex flex-col shrink-0 bg-surface">
          <div className="px-5 h-14 border-b border-rule flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.5} />
            <p className="eyebrow">Preview</p>
          </div>
          <div className="flex-1 overflow-y-auto">

            {/* Identity */}
            <div className="px-5 py-5 border-b border-rule">
              <div className="flex items-start gap-3">
                {config.iconUrl ? (
                  <img src={config.iconUrl} alt="Agent icon" className="h-12 w-12 object-cover border border-rule shrink-0" />
                ) : (
                  <div className="h-12 w-12 bg-surface-sunken border border-rule shrink-0 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-ink-faint" strokeWidth={1.5} />
                  </div>
                )}
                <div className="flex-1 min-w-0 pt-0.5">
                  {config.name && config.name !== "New Agent" ? (
                    <p className="text-sm font-semibold text-ink leading-snug">{config.name}</p>
                  ) : (
                    <p className="text-sm text-ink-faint italic leading-snug">Unnamed agent</p>
                  )}
                  {config.description ? (
                    <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">{config.description}</p>
                  ) : (
                    <p className="text-xs text-ink-faint italic mt-1.5">No description yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Model */}
            <div className="px-5 py-4 border-b border-rule">
              <p className="eyebrow mb-2.5">Model</p>
              <ModelPreviewChip model={config.model} />
            </div>

            {/* Capabilities */}
            <div className="px-5 py-4 border-b border-rule">
              <p className="eyebrow mb-2.5">Capabilities</p>
              {(config.enabledToolSets ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(config.enabledToolSets as string[]).map((t: string) => (
                    <span key={t} className="px-2 py-0.5 text-2xs bg-surface-sunken border border-rule text-ink-muted">
                      {TOOL_LABELS[t] ?? t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-faint italic">Not set</p>
              )}
            </div>

            {/* Pages */}
            {config.pages && config.pages.length > 0 && (
              <div className="px-5 py-4 border-b border-rule">
                <p className="eyebrow mb-2.5">Pages</p>
                <div className="flex flex-wrap gap-1.5">
                  {config.pages.map((p: any) => (
                    <span key={p.label} className="px-2 py-0.5 text-2xs bg-surface-sunken border border-rule text-ink-muted">
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* System Prompt */}
            <div className="px-5 py-4">
              <p className="eyebrow mb-2.5">System Prompt</p>
              {config.systemPrompt && config.systemPrompt !== "You are a helpful AI assistant." ? (
                <button onClick={() => setSystemPromptOpen(true)} className="group w-full text-left relative">
                  <pre className="font-mono text-2xs text-ink-muted whitespace-pre-wrap bg-surface-sunken border border-rule p-3 max-h-40 overflow-hidden leading-relaxed transition-colors group-hover:border-rule-strong">
                    {config.systemPrompt}
                  </pre>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-sunken/80 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.1em] font-semibold text-ink-muted bg-surface-sunken border border-rule px-2 py-1">
                      <Maximize2 className="h-2.5 w-2.5" strokeWidth={1.75} />
                      View / Edit
                    </span>
                  </div>
                </button>
              ) : (
                <button onClick={() => setSystemPromptOpen(true)} className="text-sm text-ink-faint italic hover:text-ink-muted transition-colors">
                  Not set — click to add
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* System Prompt Dialog */}
      {systemPromptOpen && (
        <SystemPromptDialog
          prompt={config.systemPrompt ?? ""}
          editing={editingPrompt}
          onEdit={setEditingPrompt}
          onSave={handlePromptSave}
          onClose={() => { setSystemPromptOpen(false); setEditingPrompt(null); }}
        />
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

// ── System Prompt Dialog ──────────────────────────────────────────────

function SystemPromptDialog({
  prompt,
  editing,
  onEdit,
  onSave,
  onClose,
}: {
  prompt: string;
  editing: string | null;
  onEdit: (v: string | null) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const isEditing = editing !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-surface-inverse/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl h-[70vh] flex flex-col bg-surface-raised border border-rule shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-rule shrink-0">
          <p className="eyebrow">System Prompt</p>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => onEdit(null)}
                  className="text-xs text-ink-muted hover:text-ink transition-colors px-3 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={onSave}
                  className="text-xs bg-ink text-ink-inverse px-4 py-1.5 font-semibold hover:opacity-80 transition-all"
                >
                  Send to builder
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onEdit(prompt)}
                  className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.1em] font-semibold text-ink-muted hover:text-ink transition-colors px-2 py-1"
                >
                  <Pencil className="h-3 w-3" strokeWidth={1.5} />
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="p-1 text-ink-faint hover:text-ink transition-colors"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {isEditing ? (
            <textarea
              autoFocus
              value={editing}
              onChange={(e) => onEdit(e.target.value)}
              className="w-full h-full min-h-[320px] font-mono text-sm text-ink bg-transparent focus:outline-none resize-none leading-relaxed placeholder:text-ink-faint"
              placeholder="Enter system prompt…"
            />
          ) : prompt ? (
            <div className="prose max-w-none text-sm leading-relaxed
              text-ink
              prose-headings:text-ink prose-headings:font-semibold prose-headings:my-3
              prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
              prose-p:text-ink prose-p:my-2
              prose-li:text-ink prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2
              prose-strong:text-ink prose-strong:font-semibold
              prose-code:text-accent prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-surface-sunken prose-pre:border prose-pre:border-rule prose-pre:text-xs
              prose-blockquote:text-ink-muted prose-blockquote:border-rule
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-hr:border-rule">
              <Markdown remarkPlugins={[remarkGfm]}>{prompt}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-ink-faint italic">No system prompt set.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelPreviewChip({ model }: { model?: string }) {
  if (!model) return <p className="text-sm text-ink-faint italic">Not set</p>;
  const entry = CHAT_MODELS.find((m) => m.value === model);
  const Icon = getProviderIcon(entry?.group ?? "Claude");
  return (
    <div className="inline-flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-ink-faint shrink-0" />
      <span className="text-sm text-ink">{entry?.label ?? model}</span>
    </div>
  );
}
