import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useOutletContext } from "react-router";
import {
  Settings,
  Save,
  Plus,
  Trash2,
  Wrench,
  Bot,
  ToggleRight,
  Upload,
  Loader2,
  Image,
  Wand2,
  X,
  Sparkles,
  ArrowUp,
  FileText,
  RotateCcw,
  Check,
  Cpu,
} from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect, useRef } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";
import { CredentialManager } from "~/components/CredentialManager";
import { TOOL_SETS_REQUIRING_CREDENTIALS } from "@agent-maker/shared/src/credential-types";
import {
  TOOL_SET_REGISTRY,
  getToolSetsByCategory,
  getToolSetLabel,
} from "@agent-maker/shared/src/tool-set-registry";

type ToolSetCategory = {
  title: string;
  description: string;
  items: { key: string; label: string; description: string }[];
};

const CAPABILITY_CATEGORIES: ToolSetCategory[] = [
  ...getToolSetsByCategory("core"),
  ...getToolSetsByCategory("automation"),
];

const INTEGRATION_CATEGORIES: ToolSetCategory[] = getToolSetsByCategory("integration");

const AGENT_SERVER_URL =
  typeof window !== "undefined"
    ? (import.meta.env.VITE_AGENT_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`)
    : (import.meta.env.VITE_AGENT_SERVER_URL ?? "http://localhost:3001");

const SECTION_TITLES: Record<string, string> = {
  general: "General",
  models: "Models",
  capabilities: "Capabilities",
  integrations: "Integrations",
  tools: "Tools",
};

export default function SettingsPage() {
  const { agent, settingsSection } = useOutletContext<{
    agent: Doc<"agents">;
    settingsSection: string;
  }>();
  const section = settingsSection || "general";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
              <Settings className="h-4 w-4 text-zinc-300" />
            </div>
            <h1 className="text-lg font-semibold">{SECTION_TITLES[section] ?? "Settings"}</h1>
          </div>
          <Link
            to={`/agents/${agent._id}/editor`}
            className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <Wand2 className="h-4 w-4" />
            Edit with AI
          </Link>
        </div>

        {section === "general" && (
          <>
            <AgentIconSection agent={agent} />
            <AgentConfigSection agent={agent} />
          </>
        )}

        {section === "models" && (
          <EnabledModelsSection agent={agent} />
        )}

        {section === "capabilities" && (
          <ToolSetsSection agent={agent} />
        )}

        {section === "integrations" && (
          <>
            <IntegrationsSection agent={agent} />
            {(agent.enabledToolSets ?? [])
              .filter((ts) => TOOL_SETS_REQUIRING_CREDENTIALS[ts])
              .map((ts) => (
                <section key={ts} className="rounded-xl border border-zinc-800/60 glass-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-sm font-medium">
                      {getToolSetLabel(ts)} Credentials
                    </h2>
                  </div>
                  <CredentialManager agent={agent} toolSetName={ts} />
                </section>
              ))}
            {(agent.enabledToolSets ?? []).includes("discord") && (
              <DiscordBotSection agent={agent} />
            )}
            {(agent.enabledToolSets ?? []).includes("slack") && (
              <SlackBotSection agent={agent} />
            )}
          </>
        )}

        {section === "tools" && (
          <>
            {(agent.enabledToolSets ?? []).includes("rag") && (
              <DocumentsSection agent={agent} />
            )}
            <CustomToolsSection agent={agent} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Agent Icon ────────────────────────────────────────────────────────

function AgentIconSection({ agent }: { agent: Doc<"agents"> }) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const setIcon = useMutation(api.agents.setIcon);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
      await setIcon({ agentId: agent._id, storageId });
    } catch (err: any) {
      alert("Failed to upload icon");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="rounded-xl border border-zinc-800/60 glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Image className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-medium">Agent Icon</h2>
      </div>
      <div className="flex items-center gap-4">
        {agent.iconUrl ? (
          <img
            src={agent.iconUrl}
            alt="Agent icon"
            className="h-16 w-16 rounded-xl object-cover border border-zinc-700"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Bot className="h-7 w-7 text-zinc-600" />
          </div>
        )}
        <div>
          <label
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
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
            {uploading ? "Uploading..." : "Upload new icon"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          <p className="text-[10px] text-zinc-600 mt-1.5">PNG, JPG up to 2MB</p>
        </div>
      </div>
    </section>
  );
}

// ── Agent Config ─────────────────────────────────────────────────────

function AgentConfigSection({ agent }: { agent: Doc<"agents"> }) {
  const updateAgent = useMutation(api.agents.update);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [saving, setSaving] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description ?? "");
    setSystemPrompt(agent.systemPrompt);
  }, [agent]);

  const hasChanges =
    name !== agent.name ||
    description !== (agent.description ?? "") ||
    systemPrompt !== agent.systemPrompt;

  async function handleSave() {
    setSaving(true);
    try {
      await updateAgent({
        agentId: agent._id,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
      });
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  return (
    <>
      <section className="rounded-xl border border-zinc-800/60 glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-medium">Agent Configuration</h2>
          </div>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3 w-3" />
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>

        <div className="space-y-4">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </Field>

          <Field label="Description">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </Field>

          {/* System Prompt Preview Card */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              System Prompt
            </label>
            <button
              onClick={() => setShowPromptDialog(true)}
              className="w-full text-left group"
            >
              <div className="relative rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 hover:border-zinc-600 hover:bg-zinc-800/80 transition-all cursor-pointer">
                {systemPrompt ? (
                  <>
                    <p className="text-sm text-zinc-300 font-mono line-clamp-3 leading-relaxed">
                      {systemPrompt}
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-800/80 to-transparent rounded-b-xl pointer-events-none" />
                  </>
                ) : (
                  <p className="text-sm text-zinc-600 italic">
                    No system prompt configured. Click to add one.
                  </p>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-700/50">
                  <span className="text-[11px] text-zinc-500">
                    {systemPrompt
                      ? `${systemPrompt.length} characters`
                      : "Empty"}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    <FileText className="h-3 w-3" />
                    Edit Prompt
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </section>

      {showPromptDialog && (
        <SystemPromptDialog
          value={systemPrompt}
          onChange={setSystemPrompt}
          onClose={() => setShowPromptDialog(false)}
          agentName={name}
          agentDescription={description}
        />
      )}
    </>
  );
}

// ── System Prompt Dialog ─────────────────────────────────────────────

const QUICK_ACTIONS = [
  "Make it more concise",
  "Add error handling instructions",
  "Make the tone more professional",
  "Add output format guidelines",
  "Add safety guardrails",
  "Improve clarity and structure",
];

function SystemPromptDialog({
  value,
  onChange,
  onClose,
  agentName,
  agentDescription,
}: {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
  agentName: string;
  agentDescription: string;
}) {
  const [draft, setDraft] = useState(value);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  // When AI suggests, we store the draft before the suggestion so we can revert
  const [beforeSuggestion, setBeforeSuggestion] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const hasSuggestion = beforeSuggestion !== null;

  function handleSave() {
    onChange(draft);
    onClose();
  }

  async function handleAiAssist(instruction: string) {
    if (!instruction.trim() || aiLoading) return;
    setAiLoading(true);
    setAiInput("");
    try {
      const res = await fetch(`${AGENT_SERVER_URL}/assist-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPrompt: draft,
          instruction: instruction.trim(),
          agentName,
          agentDescription,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.prompt || !data.prompt.trim()) throw new Error("AI returned empty result");
      // Save current draft so we can revert, then replace draft with suggestion
      setBeforeSuggestion(draft);
      setDraft(data.prompt);
    } catch (err: any) {
      console.error("AI assist failed:", err);
    }
    setAiLoading(false);
  }

  function acceptSuggestion() {
    // Draft already has the suggestion text, just clear the revert state
    setBeforeSuggestion(null);
  }

  function dismissSuggestion() {
    if (beforeSuggestion !== null) {
      setDraft(beforeSuggestion);
      setBeforeSuggestion(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/20 to-indigo-600/20 ring-1 ring-violet-500/20">
              <FileText className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                System Prompt
              </h2>
              <p className="text-[11px] text-zinc-500">
                Define how your agent behaves and responds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Editor */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="You are a helpful assistant that..."
              disabled={aiLoading}
              className={`w-full min-h-[280px] rounded-xl border px-4 py-3.5 text-sm font-mono leading-relaxed placeholder:text-zinc-600 focus:outline-none resize-none transition-colors disabled:opacity-60 ${
                hasSuggestion
                  ? "border-violet-500/40 bg-violet-950/10 text-violet-200"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200 focus:border-zinc-500"
              }`}
            />
            {aiLoading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-zinc-900/60 backdrop-blur-[2px]">
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 shadow-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  <span className="text-xs text-zinc-300">Generating improved prompt...</span>
                </div>
              </div>
            )}
          </div>

          {/* Suggestion action bar */}
          {hasSuggestion && (
            <div className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs text-violet-300">
                  AI suggestion — review and accept or dismiss
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={dismissSuggestion}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Dismiss
                </button>
                <button
                  onClick={acceptSuggestion}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Accept
                </button>
              </div>
            </div>
          )}

          {/* AI Assistant */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-zinc-300">
                AI Prompt Assistant
              </span>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleAiAssist(action)}
                  disabled={aiLoading}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/50 disabled:opacity-40 transition-all"
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Custom instruction input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAiAssist(aiInput);
              }}
              className="relative"
            >
              <input
                ref={aiInputRef}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                disabled={aiLoading}
                placeholder={
                  draft
                    ? "Describe how to improve this prompt..."
                    : "Describe what your agent should do..."
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 pl-4 pr-12 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={!aiInput.trim() || aiLoading}
                className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                  aiInput.trim() && !aiLoading
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "bg-zinc-700 text-zinc-500"
                }`}
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/30">
          <span className="text-[11px] text-zinc-600">
            {draft.length} characters
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={hasSuggestion}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-neon-400 text-zinc-950 rounded-lg hover:bg-neon-300 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3 w-3" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Enabled Models ────────────────────────────────────────────────────

const ALL_MODELS = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    description: "Balanced speed and capability",
    provider: "Anthropic",
    tier: "$$",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    description: "Most capable Claude model",
    provider: "Anthropic",
    tier: "$$$",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    description: "Fastest and most affordable",
    provider: "Anthropic",
    tier: "$",
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    description: "Most capable Gemini model",
    provider: "Google",
    tier: "$$$",
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    description: "Lightning-fast with agentic capability",
    provider: "Google",
    tier: "$$",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Balanced Gemini model",
    provider: "Google",
    tier: "$$",
  },
];

function EnabledModelsSection({ agent }: { agent: Doc<"agents"> }) {
  const updateAgent = useMutation(api.agents.update);
  // If enabledModels is not set, all models are enabled by default
  const enabledModels = agent.enabledModels ?? ALL_MODELS.map((m) => m.id);

  async function handleToggle(modelId: string) {
    const isCurrentModel = agent.model === modelId;
    const isEnabled = enabledModels.includes(modelId);

    if (isEnabled && isCurrentModel) return; // can't disable the active model
    if (isEnabled && enabledModels.length <= 1) return; // must keep at least one

    const newModels = isEnabled
      ? enabledModels.filter((m) => m !== modelId)
      : [...enabledModels, modelId];

    try {
      await updateAgent({ agentId: agent._id, enabledModels: newModels });
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800/60 glass-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Cpu className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-medium">Enabled Models</h2>
        <span className="text-xs text-zinc-600 ml-auto">
          {enabledModels.length} of {ALL_MODELS.length}
        </span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Choose which models appear in the chat model selector.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {ALL_MODELS.map((m) => {
          const enabled = enabledModels.includes(m.id);
          const isCurrentModel = agent.model === m.id;
          const cantDisable = enabled && (isCurrentModel || enabledModels.length <= 1);
          return (
            <button
              key={m.id}
              onClick={() => handleToggle(m.id)}
              disabled={cantDisable}
              title={
                isCurrentModel
                  ? "Can't disable the currently active model"
                  : enabledModels.length <= 1 && enabled
                    ? "At least one model must be enabled"
                    : undefined
              }
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                enabled
                  ? "border-neon-400/20 bg-neon-400/5 hover:bg-neon-400/10"
                  : "border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/60"
              } ${cantDisable ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              <div
                className={`relative h-5 w-9 rounded-full shrink-0 transition-colors ${
                  enabled ? "bg-neon-400/30" : "bg-zinc-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                    enabled
                      ? "left-[18px] bg-neon-400 shadow-sm shadow-neon-400/40"
                      : "left-0.5 bg-zinc-500"
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${enabled ? "text-zinc-100" : "text-zinc-400"}`}>
                    {m.name}
                  </span>
                  <span className={`text-[10px] font-mono ${
                    m.tier === "$$$" ? "text-amber-400" : m.tier === "$$" ? "text-zinc-500" : "text-zinc-600"
                  }`}>{m.tier}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-zinc-600 line-clamp-1">{m.description}</p>
                  {isCurrentModel && (
                    <span className="text-[9px] text-neon-400 font-medium shrink-0">ACTIVE</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Tool Set Toggle Grid (shared) ────────────────────────────────────

function ToolSetCategoryGrid({
  categories,
  enabledSets,
  onToggle,
}: {
  categories: ToolSetCategory[];
  enabledSets: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category.title}>
          <div className="flex items-center gap-2 mb-2.5">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {category.title}
            </h3>
            <div className="flex-1 h-px bg-zinc-800/60" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {category.items.map((item) => {
              const enabled = enabledSets.includes(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => onToggle(item.key)}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                    enabled
                      ? "border-neon-400/20 bg-neon-400/5 hover:bg-neon-400/10"
                      : "border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/60"
                  }`}
                >
                  <div
                    className={`relative h-5 w-9 rounded-full shrink-0 transition-colors ${
                      enabled ? "bg-neon-400/30" : "bg-zinc-700"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                        enabled
                          ? "left-[18px] bg-neon-400 shadow-sm shadow-neon-400/40"
                          : "left-0.5 bg-zinc-500"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${enabled ? "text-zinc-100" : "text-zinc-400"}`}>
                      {item.label}
                    </span>
                    <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function useToolSetToggle(agent: Doc<"agents">) {
  const updateAgent = useMutation(api.agents.update);
  const enabledSets = agent.enabledToolSets ?? [];

  async function handleToggle(toolSet: string) {
    const newSets = enabledSets.includes(toolSet)
      ? enabledSets.filter((s) => s !== toolSet)
      : [...enabledSets, toolSet];

    try {
      await updateAgent({
        agentId: agent._id,
        enabledToolSets: newSets,
      });
    } catch (err: any) {
      alert(err.message);
    }
  }

  return { enabledSets, handleToggle };
}

// ── Capabilities Section ─────────────────────────────────────────────

function ToolSetsSection({ agent }: { agent: Doc<"agents"> }) {
  const { enabledSets, handleToggle } = useToolSetToggle(agent);

  return (
    <section className="rounded-xl border border-zinc-800/60 glass-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <ToggleRight className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-medium">Capabilities</h2>
        <span className="text-xs text-zinc-600 ml-auto">
          {enabledSets.length} active
        </span>
      </div>
      <ToolSetCategoryGrid
        categories={CAPABILITY_CATEGORIES}
        enabledSets={enabledSets}
        onToggle={handleToggle}
      />
    </section>
  );
}

// ── Integrations Section ─────────────────────────────────────────────

function IntegrationsSection({ agent }: { agent: Doc<"agents"> }) {
  const { enabledSets, handleToggle } = useToolSetToggle(agent);

  return (
    <section className="rounded-xl border border-zinc-800/60 glass-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <ToggleRight className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-medium">Integrations</h2>
        <span className="text-xs text-zinc-600 ml-auto">
          {enabledSets.filter((s) =>
            INTEGRATION_CATEGORIES.some((c) => c.items.some((i) => i.key === s))
          ).length} active
        </span>
      </div>
      <ToolSetCategoryGrid
        categories={INTEGRATION_CATEGORIES}
        enabledSets={enabledSets}
        onToggle={handleToggle}
      />
    </section>
  );
}

// ── Discord Bot (Gateway / two-way chat) ────────────────────────────

function DiscordBotSection({ agent }: { agent: Doc<"agents"> }) {
  const updateDiscordBot = useMutation(api.agents.updateDiscordBot);

  const [enabled, setEnabled] = useState(agent.discordBotEnabled ?? false);
  const [botPrompt, setBotPrompt] = useState(agent.discordBotPrompt ?? "");
  const [botModel, setBotModel] = useState(agent.discordBotModel ?? "");
  const [authorizedUsers, setAuthorizedUsers] = useState<string[]>(
    agent.discordAuthorizedUsers ?? []
  );
  const [newUser, setNewUser] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateDiscordBot({
        agentId: agent._id,
        discordBotEnabled: enabled,
        discordBotPrompt: botPrompt || undefined,
        discordBotModel: botModel || undefined,
        discordAuthorizedUsers: authorizedUsers,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  function addUser() {
    const username = newUser.trim();
    if (!username || authorizedUsers.includes(username)) return;
    setAuthorizedUsers([...authorizedUsers, username]);
    setNewUser("");
  }

  function removeUser(username: string) {
    setAuthorizedUsers(authorizedUsers.filter((u) => u !== username));
  }

  return (
    <section className="rounded-xl border border-zinc-800/60 glass-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-medium">Discord Bot (Two-Way Chat)</h2>
        <span className="text-xs text-zinc-600 ml-auto">
          @mention the bot to chat
        </span>
      </div>

      <p className="text-xs text-zinc-500">
        When enabled, @mentioning the bot in Discord routes messages through this agent.
        Authorized users get full agent access; everyone else gets the Bot Prompt below.
      </p>

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Enable Discord Bot</span>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? "bg-neon-500" : "bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Bot Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Bot Prompt</label>
            <textarea
              value={botPrompt}
              onChange={(e) => setBotPrompt(e.target.value)}
              placeholder="You are a helpful assistant. Answer questions concisely..."
              rows={4}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-zinc-600">
              Used for non-authorized Discord users. Leave blank to use the agent's system prompt for everyone.
            </p>
          </div>

          {/* Bot Model */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Bot Model (optional)</label>
            <select
              value={botModel}
              onChange={(e) => setBotModel(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors"
            >
              <option value="">Use agent's default ({ALL_MODELS.find((m) => m.id === agent.model)?.name ?? agent.model})</option>
              {(agent.enabledModels ?? ALL_MODELS.map((m) => m.id)).map((modelId) => {
                const model = ALL_MODELS.find((m) => m.id === modelId);
                return (
                  <option key={modelId} value={modelId}>
                    {model ? `${model.name} — ${model.description}` : modelId}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-zinc-600">
              Model to use for bot-mode responses. Only shows models enabled for this agent.
            </p>
          </div>

          {/* Authorized Users */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Authorized Discord Usernames</label>
            <p className="text-xs text-zinc-600">
              These users get full agent access (all tools, memory, etc.) when they @mention the bot.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUser()}
                placeholder="discord_username"
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={addUser}
                className="text-xs bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Add
              </button>
            </div>
            {authorizedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {authorizedUsers.map((u) => (
                  <span
                    key={u}
                    className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 text-xs px-2.5 py-1 rounded-lg"
                  >
                    {u}
                    <button
                      type="button"
                      onClick={() => removeUser(u)}
                      className="text-zinc-500 hover:text-red-400 transition-colors ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all flex items-center gap-1.5"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : saved ? (
            <Check className="h-3 w-3" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </section>
  );
}

// ── Slack Bot (Socket Mode / two-way chat) ──────────────────────────

function SlackBotSection({ agent }: { agent: Doc<"agents"> }) {
  const updateSlackBot = useMutation(api.agents.updateSlackBot);

  const [enabled, setEnabled] = useState((agent as any).slackBotEnabled ?? false);
  const [botPrompt, setBotPrompt] = useState((agent as any).slackBotPrompt ?? "");
  const [botModel, setBotModel] = useState((agent as any).slackBotModel ?? "");
  const [authorizedUsers, setAuthorizedUsers] = useState<string[]>(
    (agent as any).slackAuthorizedUsers ?? []
  );
  const [newUser, setNewUser] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateSlackBot({
        agentId: agent._id,
        slackBotEnabled: enabled,
        slackBotPrompt: botPrompt || undefined,
        slackBotModel: botModel || undefined,
        slackAuthorizedUsers: authorizedUsers,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  function addUser() {
    const id = newUser.trim();
    if (!id || authorizedUsers.includes(id)) return;
    setAuthorizedUsers([...authorizedUsers, id]);
    setNewUser("");
  }

  function removeUser(id: string) {
    setAuthorizedUsers(authorizedUsers.filter((u) => u !== id));
  }

  return (
    <section className="rounded-xl border border-zinc-800/60 glass-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-medium">Slack Bot (Two-Way Chat)</h2>
        <span className="text-xs text-zinc-600 ml-auto">
          @mention or DM the bot to chat
        </span>
      </div>

      <p className="text-xs text-zinc-500">
        When enabled, @mentioning the bot in a Slack channel or sending it a DM routes
        messages through this agent. Authorized users get full agent access; everyone
        else gets the Bot Prompt below. Requires an App-Level Token (xapp-…) on the
        Slack credential and Socket Mode enabled in your Slack app.
      </p>

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Enable Slack Bot</span>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? "bg-neon-500" : "bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Bot Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Bot Prompt</label>
            <textarea
              value={botPrompt}
              onChange={(e) => setBotPrompt(e.target.value)}
              placeholder="You are a helpful assistant. Answer questions concisely..."
              rows={4}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-zinc-600">
              Used for non-authorized Slack users. Leave blank to use the agent's system prompt for everyone.
            </p>
          </div>

          {/* Bot Model */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Bot Model (optional)</label>
            <select
              value={botModel}
              onChange={(e) => setBotModel(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors"
            >
              <option value="">Use agent's default ({ALL_MODELS.find((m) => m.id === agent.model)?.name ?? agent.model})</option>
              {(agent.enabledModels ?? ALL_MODELS.map((m) => m.id)).map((modelId) => {
                const model = ALL_MODELS.find((m) => m.id === modelId);
                return (
                  <option key={modelId} value={modelId}>
                    {model ? `${model.name} — ${model.description}` : modelId}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-zinc-600">
              Model to use for bot-mode responses. Only shows models enabled for this agent.
            </p>
          </div>

          {/* Authorized Users */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Authorized Slack User IDs</label>
            <p className="text-xs text-zinc-600">
              Slack user IDs (e.g. <code className="text-zinc-400 bg-zinc-800 px-1 rounded">U0AR2KKC2Q3</code>) get full agent access. Find IDs by opening a profile in Slack → "More" → "Copy member ID", or call <code className="text-zinc-400 bg-zinc-800 px-1 rounded">slack_list_users</code>.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUser()}
                placeholder="U01234ABCDE"
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={addUser}
                className="text-xs bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Add
              </button>
            </div>
            {authorizedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {authorizedUsers.map((u) => (
                  <span
                    key={u}
                    className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 text-xs px-2.5 py-1 rounded-lg"
                  >
                    {u}
                    <button
                      type="button"
                      onClick={() => removeUser(u)}
                      className="text-zinc-500 hover:text-red-400 transition-colors ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all flex items-center gap-1.5"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : saved ? (
            <Check className="h-3 w-3" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </section>
  );
}

// ── Custom Tools ─────────────────────────────────────────────────────

function CustomToolsSection({ agent }: { agent: Doc<"agents"> }) {
  const tools = useQuery(api.customTools.list, { agentId: agent._id });
  const createTool = useMutation(api.customTools.create);
  const removeTool = useMutation(api.customTools.remove);
  const [showAdd, setShowAdd] = useState(false);
  const [newTool, setNewTool] = useState({
    name: "",
    description: "",
    endpoint: "",
    method: "GET" as const,
  });

  async function handleCreate() {
    if (!newTool.name.trim() || !newTool.endpoint.trim()) return;
    try {
      await createTool({
        agentId: agent._id,
        name: newTool.name.trim(),
        description: newTool.description.trim() || newTool.name.trim(),
        endpoint: newTool.endpoint.trim(),
        method: newTool.method,
      });
      setNewTool({ name: "", description: "", endpoint: "", method: "GET" });
      setShowAdd(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800/60 glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-medium">Custom HTTP Tools</h2>
          {tools && (
            <span className="text-xs text-zinc-500">({tools.length})</span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add Tool
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tool Name">
              <input
                type="text"
                value={newTool.name}
                onChange={(e) =>
                  setNewTool({ ...newTool, name: e.target.value })
                }
                placeholder="get_weather"
                className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </Field>
            <Field label="HTTP Method">
              <select
                value={newTool.method}
                onChange={(e) =>
                  setNewTool({ ...newTool, method: e.target.value as any })
                }
                className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm focus:outline-none"
              >
                {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Endpoint URL">
            <input
              type="text"
              value={newTool.endpoint}
              onChange={(e) =>
                setNewTool({ ...newTool, endpoint: e.target.value })
              }
              placeholder="https://api.example.com/data"
              className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm font-mono placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </Field>
          <Field label="Description">
            <input
              type="text"
              value={newTool.description}
              onChange={(e) =>
                setNewTool({ ...newTool, description: e.target.value })
              }
              placeholder="What does this tool do?"
              className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </Field>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newTool.name.trim() || !newTool.endpoint.trim()}
              className="text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-md font-medium hover:bg-zinc-200 disabled:opacity-30 transition-colors"
            >
              Add Tool
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-xs text-zinc-500 px-2 py-1.5 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {tools === undefined ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-zinc-800 animate-pulse"
            />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No custom tools. Add HTTP endpoints that your agent can call during
          conversations.
        </p>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => (
            <div
              key={tool._id}
              className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
                    {tool.method}
                  </span>
                  <span className="text-sm font-medium">{tool.name}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate max-w-md">
                  {tool.endpoint}
                </p>
              </div>
              <button
                onClick={() => removeTool({ toolId: tool._id })}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Documents / Knowledge Base ────────────────────────────────────────

const FILE_TYPES: Record<string, string> = {
  pdf: "PDF",
  txt: "TXT",
  md: "MD",
  docx: "DOCX",
  csv: "CSV",
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPG",
  webp: "WEBP",
  gif: "GIF",
};

const ACCEPT = ".pdf,.txt,.md,.docx,.csv,.png,.jpg,.jpeg,.webp,.gif";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function DocumentsSection({ agent }: { agent: Doc<"agents"> }) {
  const documents = useQuery(api.documents.list, { agentId: agent._id });
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const getStorageUrl = useConvex();
  const uploadDoc = useMutation(api.documents.upload);
  const removeDoc = useMutation(api.documents.remove);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function getFileType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    return FILE_TYPES[ext] ? ext : "";
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = getFileType(file.name);
    if (!fileType) {
      alert("Unsupported file type. Accepted: PDF, TXT, MD, DOCX, CSV, PNG, JPG, WEBP, GIF");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("File must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      // Upload to Convex storage
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const { storageId } = await result.json();

      // Create document record
      const documentId = await uploadDoc({
        agentId: agent._id,
        fileName: file.name,
        fileType,
        storageId,
        fileSize: file.size,
      });

      // Get the actual storage URL
      const storageUrl = await getStorageUrl.query(api.storage.getUrl, {
        storageId,
      });

      // Trigger processing
      await fetch(`${AGENT_SERVER_URL}/process-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          storageUrl,
          fileName: file.name,
          fileType,
          agentId: agent._id,
        }),
      });
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRetry(doc: any) {
    try {
      const storageUrl = await getStorageUrl.query(api.storage.getUrl, {
        storageId: doc.storageId,
      });
      if (!storageUrl) {
        alert("Storage file not found — please re-upload the document.");
        return;
      }
      await fetch(`${AGENT_SERVER_URL}/process-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc._id,
          storageUrl,
          fileName: doc.fileName,
          fileType: doc.fileType,
          agentId: agent._id,
        }),
      });
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  }

  const statusColors: Record<string, string> = {
    uploading: "text-yellow-400",
    processing: "text-blue-400",
    ready: "text-neon-400",
    error: "text-red-400",
  };

  const statusLabels: Record<string, string> = {
    uploading: "Uploading...",
    processing: "Processing...",
    ready: "Ready",
    error: "Error",
  };

  return (
    <section className="rounded-xl border border-zinc-800/60 glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-medium">Knowledge Base</h2>
          {documents && (
            <span className="text-xs text-zinc-500">
              ({documents.length} document{documents.length !== 1 ? "s" : ""})
            </span>
          )}
        </div>
        <label
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md cursor-pointer transition-colors ${
            uploading
              ? "text-zinc-500"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {uploading ? "Uploading..." : "Upload Document"}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {documents === undefined ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-zinc-800 animate-pulse"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No documents uploaded. Upload PDF, TXT, MD, DOCX, CSV, or image files for
          your agent to search during conversations.
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-mono uppercase bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded shrink-0">
                  {doc.fileType}
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {doc.fileName}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-[10px] ${statusColors[doc.status] ?? "text-zinc-500"}`}
                    >
                      {doc.status === "processing" && (
                        <Loader2 className="h-2.5 w-2.5 animate-spin inline mr-1" />
                      )}
                      {statusLabels[doc.status] ?? doc.status}
                    </span>
                    {doc.chunkCount && (
                      <span className="text-[10px] text-zinc-600">
                        {doc.chunkCount} chunks
                      </span>
                    )}
                    {doc.error && (
                      <span className="text-[10px] text-red-400 truncate max-w-48">
                        {doc.error}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {doc.status === "error" && (
                  <button
                    onClick={() => handleRetry(doc)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-zinc-800 transition-all"
                    title="Retry processing"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => removeDoc({ documentId: doc._id })}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
