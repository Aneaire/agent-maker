import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useNavigate, Link } from "react-router";
import { useState, useEffect, useRef } from "react";
import { ChatMessageList } from "~/components/ChatMessageList";
import { ChatInput } from "~/components/ChatInput";
import { ChevronLeft, Loader2, Upload } from "lucide-react";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import { getToolSetLabelsMap } from "@agent-maker/shared/src/tool-set-registry";

const TOOL_LABELS = getToolSetLabelsMap();

export default function AgentCreatorPage() {
  const navigate = useNavigate();
  const startSession = useMutation(api.creatorSessions.start);
  const abandonSession = useMutation(api.creatorSessions.abandon);

  const [sessionData, setSessionData] = useState<{
    sessionId: Id<"creatorSessions">;
    agentId: Id<"agents">;
    conversationId: Id<"conversations">;
  } | null>(null);

  async function handleStart() {
    try {
      const data = await startSession();
      setSessionData(data as any);
    } catch (err: any) {
      alert(err.message);
    }
  }

  useEffect(() => {
    handleStart();
  }, []);

  if (!sessionData) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <Loader2
            className="h-5 w-5 animate-spin text-ink-faint mx-auto mb-3"
            strokeWidth={1.5}
          />
          <p className="text-sm text-ink-muted">Setting up the agent creator\u2026</p>
        </div>
      </div>
    );
  }

  return (
    <CreatorView
      sessionId={sessionData.sessionId}
      agentId={sessionData.agentId}
      conversationId={sessionData.conversationId}
      onAbandon={async () => {
        await abandonSession({ sessionId: sessionData.sessionId });
        navigate("/agents/new");
      }}
    />
  );
}

function CreatorView({
  sessionId,
  agentId,
  conversationId,
  onAbandon,
}: {
  sessionId: Id<"creatorSessions">;
  agentId: Id<"agents">;
  conversationId: Id<"conversations">;
  onAbandon: () => void;
}) {
  const navigate = useNavigate();
  const session = useQuery(api.creatorSessions.get, { sessionId });
  const agent = useQuery(api.agents.get, { agentId });
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const stopMessage = useMutation(api.messages.stop);

  useEffect(() => {
    if (agent && agent.status === "active") {
      navigate(`/agents/${agentId}`);
    }
  }, [agent?.status]);

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
    <div className="flex h-screen bg-surface">
      {/* ── Left: Chat ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-rule px-6 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link
              to="/agents/new"
              className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted transition-colors"
            >
              <ChevronLeft className="h-3 w-3" strokeWidth={1.75} />
              Back
            </Link>
            <div className="h-4 w-px bg-rule" />
            <div>
              <p className="eyebrow leading-none">Agent creator</p>
            </div>
          </div>
          <button
            onClick={onAbandon}
            className="text-sm text-ink-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>

        {messages === undefined ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2
              className="h-4 w-4 animate-spin text-ink-faint"
              strokeWidth={1.5}
            />
          </div>
        ) : (
          <ChatMessageList messages={messages} onSendSuggestion={handleSend} />
        )}

        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          isProcessing={hasActiveRun ?? false}
          hasActiveQuestions={(() => {
            const last = messages?.[messages.length - 1];
            return !!(
              last?.role === "assistant" &&
              last?.status === "done" &&
              last?.questions?.length
            );
          })()}
        />
      </div>

      {/* ── Right: Agent preview ───────────────────────────────── */}
      <aside className="w-80 border-l border-rule flex flex-col shrink-0 bg-surface">
        <div className="px-5 h-14 border-b border-rule flex items-center">
          <p className="eyebrow">Preview</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          <IconUpload agentId={agentId} currentIconUrl={config.iconUrl} />

          <ConfigField label="Name" value={config.name} />
          <ConfigField label="Description" value={config.description} />
          <ConfigField label="Model" value={config.model} />

          <div>
            <p className="eyebrow mb-2">Capabilities</p>
            {(config.enabledToolSets ?? []).length > 0 ? (
              <p className="text-sm text-ink leading-relaxed">
                {(config.enabledToolSets as string[]).map((t, i) => (
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

          <div>
            <p className="eyebrow mb-2">System prompt</p>
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
    </div>
  );
}

function IconUpload({
  agentId,
  currentIconUrl,
}: {
  agentId: Id<"agents">;
  currentIconUrl?: string;
}) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const setIcon = useMutation(api.agents.setIcon);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await setIcon({ agentId, storageId });
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Failed to upload icon. Please try again.");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <p className="eyebrow mb-2">Icon</p>
      <div className="flex items-center gap-4">
        {currentIconUrl ? (
          <img
            src={currentIconUrl}
            alt="Agent icon"
            className="h-12 w-12 rounded-sm object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-sm bg-surface-sunken" />
        )}
        <div>
          <label className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink cursor-pointer transition-colors">
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <Upload className="h-3 w-3" strokeWidth={1.5} />
            )}
            {uploading ? "Uploading\u2026" : "Upload"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
          <p className="mt-1 text-2xs text-ink-faint">PNG or JPG, up to 2MB</p>
        </div>
      </div>
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
