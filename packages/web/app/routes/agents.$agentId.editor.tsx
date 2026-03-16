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
  Upload,
  Image,
  History,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";

const TOOL_LABELS: Record<string, string> = {
  memory: "Memory",
  web_search: "Web Search",
  pages: "Pages (Tasks, Notes, Spreadsheets)",
  custom_http_tools: "Custom HTTP Tools",
  rest_api: "REST API",
  postgres: "PostgreSQL",
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
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Starting the Agent Editor...</p>
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
  const session = useQuery(api.creatorSessions.get, { sessionId });
  const agent = useQuery(api.agents.get, { agentId });
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const stopMessage = useMutation(api.messages.stop);
  const pastSessions = useQuery(api.creatorSessions.listByAgent, { agentId });

  const [showHistory, setShowHistory] = useState(false);
  const [viewingConversationId, setViewingConversationId] =
    useState<Id<"conversations"> | null>(null);

  // Redirect when session is completed
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

  const config = (session?.partialConfig as any) ?? {};

  return (
    <div className="flex h-screen bg-zinc-950">
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
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Link
              to={`/agents/${agentId}/settings`}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              Settings
            </Link>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium">
                Editing{agent ? `: ${agent.name}` : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                showHistory
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              History
              {pastSessions && pastSessions.length > 0 && (
                <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pastSessions.length}
                </span>
              )}
            </button>
            <button
              onClick={onAbandon}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Messages */}
        {messages === undefined ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
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
        <div className="w-80 border-l border-zinc-800 flex flex-col shrink-0 bg-zinc-950">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-zinc-400" />
              Agent Config
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Icon */}
            {config.iconUrl && (
              <div>
                <span className="text-xs text-zinc-500 block mb-1.5">Icon</span>
                <img
                  src={config.iconUrl}
                  alt="Agent icon"
                  className="h-12 w-12 rounded-xl object-cover border border-zinc-700"
                />
              </div>
            )}

            <ConfigField label="Name" value={config.name} />
            <ConfigField label="Description" value={config.description} />
            <ConfigField label="Model" value={config.model} />
            <div>
              <span className="text-xs text-zinc-500 block mb-1.5">
                Capabilities
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(config.enabledToolSets ?? []).map((t: string) => (
                  <span
                    key={t}
                    className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full"
                  >
                    {TOOL_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            </div>
            {config.pages && config.pages.length > 0 && (
              <div>
                <span className="text-xs text-zinc-500 block mb-1.5">Pages</span>
                <div className="flex flex-wrap gap-1.5">
                  {config.pages.map((p: any) => (
                    <span
                      key={p.label}
                      className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full"
                    >
                      {p.label} ({p.type})
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-xs text-zinc-500 block mb-1">
                System Prompt
              </span>
              {config.systemPrompt &&
              config.systemPrompt !== "You are a helpful AI assistant." ? (
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-900 border border-zinc-800 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {config.systemPrompt}
                </pre>
              ) : (
                <span className="text-xs text-zinc-600 italic">Default</span>
              )}
            </div>
          </div>
        </div>
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
    <div className="w-72 border-r border-zinc-800 flex flex-col shrink-0 bg-zinc-950">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4 text-zinc-400" />
          Edit History
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center">
            <MessageSquare className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No previous edit sessions</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Your edit history will appear here
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((s) => {
              const isViewing = viewingConversationId === s.conversationId;
              return (
                <button
                  key={s._id}
                  onClick={() =>
                    s.conversationId && onSelectSession(s.conversationId)
                  }
                  disabled={!s.conversationId}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors group ${
                    isViewing
                      ? "bg-zinc-800 border border-zinc-700"
                      : "hover:bg-zinc-800/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {s.status === "completed" ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : s.status === "abandoned" ? (
                      <XCircle className="h-3 w-3 text-zinc-600 shrink-0" />
                    ) : (
                      <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                    <span className="text-[10px] text-zinc-500">
                      {formatDate(s._creationTime)}
                    </span>
                    <span className="text-[10px] text-zinc-600 ml-auto">
                      {s.messageCount} msgs
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 truncate leading-snug">
                    {s.preview}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${
                        s.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : s.status === "abandoned"
                            ? "bg-zinc-800 text-zinc-600"
                            : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {s.status === "completed"
                        ? "Applied"
                        : s.status === "abandoned"
                          ? "Cancelled"
                          : "Active"}
                    </span>
                    <span className="text-[9px] text-zinc-600 uppercase tracking-wider">
                      {s.mode ?? "edit"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
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
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Back to editor
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">
              Past Edit Session
            </span>
          </div>
        </div>
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider bg-zinc-800 px-2 py-1 rounded">
          Read-only
        </span>
      </div>

      {/* Messages (read-only) */}
      {messages === undefined ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          No messages found for this session
        </div>
      ) : (
        <ChatMessageList messages={messages} />
      )}
    </div>
  );
}

function ConfigField({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>
      <span className="text-xs text-zinc-500 block mb-0.5">{label}</span>
      {value ? (
        <span className="text-sm text-zinc-200">{value}</span>
      ) : (
        <span className="text-xs text-zinc-600 italic">Not set</span>
      )}
    </div>
  );
}
