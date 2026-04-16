import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useNavigate, Link } from "react-router";
import { useState, useEffect, useRef } from "react";
import { ChatMessageList } from "~/components/ChatMessageList";
import { ChatInput } from "~/components/ChatInput";
import { ChevronLeft, Loader2, Upload } from "lucide-react";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import { getToolSetLabelsMap } from "@agent-maker/shared/src/tool-set-registry";
import { CHAT_MODELS, getProviderIcon } from "~/components/ModelDropdown";

const TOOL_LABELS = getToolSetLabelsMap();

const PROVIDER_TO_CRED: Record<string, string> = {
  Claude: "anthropic",
  Gemini: "google_ai",
  OpenAI: "openai",
};

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
          <p className="text-sm text-ink-muted">Setting up the agent builder\u2026</p>
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
  const setCreatorModel = useMutation(api.creatorSessions.setCreatorModel);
  const aiProviders = useQuery(api.credentials.listAiProviders);

  const creatorModel = (session as any)?.creatorModel ?? "claude-sonnet-4-6";
  const enabledModels =
    aiProviders && aiProviders.length > 0
      ? CHAT_MODELS.filter((m) => {
          const cred = PROVIDER_TO_CRED[m.group];
          return cred ? aiProviders.includes(cred) : true;
        }).map((m) => m.value)
      : undefined;

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
              <p className="eyebrow leading-none">Agent Builder</p>
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
          model={creatorModel}
          onModelChange={(model) => setCreatorModel({ sessionId, model })}
          enabledModels={enabledModels}
          lockModelDuringProcessing={false}
        />
      </div>

      {/* ── Right: Agent preview ───────────────────────────────── */}
      <aside className="w-80 border-l border-rule flex flex-col shrink-0 bg-surface">
        <div className="px-5 h-14 border-b border-rule flex items-center">
          <p className="eyebrow">Preview</p>
        </div>
        <div className="flex-1 overflow-y-auto">

          {/* Identity */}
          <div className="px-5 py-5 border-b border-rule">
            <div className="flex items-start gap-3">
              <IconUpload agentId={agentId} currentIconUrl={config.iconUrl} />
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
                {(config.enabledToolSets as string[]).map((t) => (
                  <span key={t} className="px-2 py-0.5 text-2xs bg-surface-sunken border border-rule text-ink-muted">
                    {TOOL_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-faint italic">Not set</p>
            )}
          </div>

          {/* System prompt */}
          <div className="px-5 py-4">
            <p className="eyebrow mb-2.5">System prompt</p>
            {config.systemPrompt && config.systemPrompt !== "You are a helpful AI assistant." ? (
              <pre className="font-mono text-2xs text-ink-muted whitespace-pre-wrap bg-surface-sunken border border-rule p-3 max-h-40 overflow-hidden leading-relaxed">
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
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB"); return; }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
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
    <label className="relative group/icon shrink-0 cursor-pointer block h-12 w-12">
      {currentIconUrl ? (
        <img src={currentIconUrl} alt="Agent icon" className="h-12 w-12 object-cover border border-rule" />
      ) : (
        <div className="h-12 w-12 bg-surface-sunken border border-dashed border-rule flex items-center justify-center">
          {uploading
            ? <Loader2 className="h-4 w-4 text-ink-faint animate-spin" strokeWidth={1.5} />
            : <Upload className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.5} />
          }
        </div>
      )}
      <div className="absolute inset-0 bg-surface-inverse/50 flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition-opacity">
        {uploading
          ? <Loader2 className="h-3.5 w-3.5 text-ink-inverse animate-spin" strokeWidth={1.5} />
          : <Upload className="h-3.5 w-3.5 text-ink-inverse" strokeWidth={1.5} />
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={uploading} />
    </label>
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
