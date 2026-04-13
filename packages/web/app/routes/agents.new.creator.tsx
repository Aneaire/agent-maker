import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import { ChatMessageList } from "~/components/ChatMessageList";
import { ChatInput } from "~/components/ChatInput";
import {
  Bot,
  ChevronLeft,
  Wand2,
  Loader2,
  Upload,
  X,
  Image,
} from "lucide-react";
import { Link } from "react-router";
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
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    try {
      const data = await startSession();
      setSessionData(data as any);
    } catch (err: any) {
      alert(err.message);
      setStarting(false);
    }
  }

  // Auto-start session on mount
  useEffect(() => {
    handleStart();
  }, []);

  if (!sessionData) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Setting up the Agent Creator...</p>
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

  // Redirect when agent is finalized
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
    <div className="flex h-screen bg-zinc-950">
      {/* Left: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Link
              to="/agents/new"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              Back
            </Link>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium">Agent Creator</span>
            </div>
          </div>
          <button
            onClick={onAbandon}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
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
      <div className="w-80 border-l border-zinc-800 flex flex-col shrink-0 bg-zinc-950">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4 text-zinc-400" />
            Agent Preview
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Icon Upload */}
          <IconUpload agentId={agentId} currentIconUrl={config.iconUrl} />

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
              <span className="text-xs text-zinc-600 italic">Not set</span>
            )}
          </div>
        </div>
      </div>
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
      <span className="text-xs text-zinc-500 block mb-1.5">Icon</span>
      <div className="flex items-center gap-3">
        {currentIconUrl ? (
          <img
            src={currentIconUrl}
            alt="Agent icon"
            className="h-12 w-12 rounded-xl object-cover border border-zinc-700"
          />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Image className="h-5 w-5 text-zinc-600" />
          </div>
        )}
        <div>
          <label
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              uploading
                ? "bg-zinc-800 text-zinc-500"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {uploading ? "Uploading..." : "Upload"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
          <p className="text-[10px] text-zinc-600 mt-1">PNG, JPG up to 2MB</p>
        </div>
      </div>
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
      {value && value !== "New Agent" ? (
        <span className="text-sm text-zinc-200">{value}</span>
      ) : (
        <span className="text-xs text-zinc-600 italic">Not set</span>
      )}
    </div>
  );
}
