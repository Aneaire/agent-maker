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

// ── Shared input / label primitives ──────────────────────────────────

const inputClass =
  "w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors";

const monoInputClass =
  "w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm font-mono text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors";

const selectClass =
  "w-full bg-surface-sunken border border-rule px-3 py-2 text-sm text-ink focus:border-rule-strong focus:outline-none transition-colors";

const textareaClass =
  "w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors resize-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="eyebrow block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ── Mini toggle (disc inside bar) ──────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 items-center border transition-colors ${
        on ? "bg-ink border-ink" : "bg-surface-sunken border-rule-strong"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 border transition-transform ${
          on ? "translate-x-[18px] bg-surface border-surface" : "translate-x-0.5 bg-ink-faint border-ink-faint"
        }`}
      />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { agent, settingsSection } = useOutletContext<{
    agent: Doc<"agents">;
    settingsSection: string;
  }>();
  const section = settingsSection || "general";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10 space-y-8">
        {/* Section header */}
        <div className="flex items-baseline justify-between border-b border-rule pb-4">
          <div>
            <p className="eyebrow">Settings</p>
            <h1 className="mt-1 font-display text-2xl text-ink">
              {SECTION_TITLES[section] ?? "Settings"}
            </h1>
          </div>
          <Link
            to={`/agents/${agent._id}/editor`}
            className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            <Wand2 className="h-3 w-3" strokeWidth={1.5} />
            Edit with AI
          </Link>
        </div>

        {section === "general" && (
          <>
            <AgentIconSection agent={agent} />
            <AgentConfigSection agent={agent} />
          </>
        )}

        {section === "models" && <EnabledModelsSection agent={agent} />}

        {section === "capabilities" && <ToolSetsSection agent={agent} />}

        {section === "integrations" && (
          <>
            <IntegrationsSection agent={agent} />
            {(agent.enabledToolSets ?? [])
              .filter((ts) => TOOL_SETS_REQUIRING_CREDENTIALS[ts])
              .map((ts) => (
                <section key={ts} className="border border-rule p-6 bg-surface">
                  <p className="eyebrow mb-4">
                    {getToolSetLabel(ts)} Credentials
                  </p>
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
    <section className="border border-rule p-6 bg-surface">
      <p className="eyebrow mb-4">Agent Icon</p>
      <div className="flex items-center gap-4">
        {agent.iconUrl ? (
          <img
            src={agent.iconUrl}
            alt="Agent icon"
            className="h-16 w-16 object-cover border border-rule"
          />
        ) : (
          <div className="h-16 w-16 border border-rule bg-surface-sunken flex items-center justify-center">
            <Bot className="h-7 w-7 text-ink-faint" strokeWidth={1.5} />
          </div>
        )}
        <div>
          <label
            className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink cursor-pointer transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <Upload className="h-3 w-3" strokeWidth={1.5} />
            )}
            {uploading ? "Uploading…" : "Upload new icon"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          <p className="text-[10px] text-ink-faint mt-1">PNG, JPG up to 2MB</p>
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
      <section className="border border-rule p-6 bg-surface">
        <div className="flex items-baseline justify-between mb-6">
          <p className="eyebrow">Agent Configuration</p>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold bg-ink text-surface px-3 py-1.5 hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <Save className="h-3 w-3" strokeWidth={1.75} />
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>

        <div className="space-y-5">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Description">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              className={inputClass}
            />
          </Field>

          <div>
            <p className="eyebrow mb-1.5">System Prompt</p>
            <button
              onClick={() => setShowPromptDialog(true)}
              className="w-full text-left group"
            >
              <div className="border border-rule bg-surface-sunken p-4 hover:border-rule-strong transition-all cursor-pointer">
                {systemPrompt ? (
                  <p className="text-sm text-ink-muted font-mono line-clamp-3 leading-relaxed">
                    {systemPrompt}
                  </p>
                ) : (
                  <p className="text-sm text-ink-faint italic">
                    No system prompt configured. Click to add one.
                  </p>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-rule">
                  <span className="font-mono text-[11px] text-ink-faint">
                    {systemPrompt ? `${systemPrompt.length} characters` : "Empty"}
                  </span>
                  <span className="text-2xs uppercase tracking-[0.1em] font-semibold text-ink-faint group-hover:text-ink transition-colors">
                    Edit prompt →
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
      setBeforeSuggestion(draft);
      setDraft(data.prompt);
    } catch (err: any) {
      console.error("AI assist failed:", err);
    }
    setAiLoading(false);
  }

  function acceptSuggestion() {
    setBeforeSuggestion(null);
  }

  function dismissSuggestion() {
    if (beforeSuggestion !== null) {
      setDraft(beforeSuggestion);
      setBeforeSuggestion(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-3xl max-h-[90vh] border border-rule bg-surface shadow-2xl flex flex-col overflow-hidden rise">
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-rule shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
            <div>
              <p className="eyebrow leading-none">System Prompt</p>
              <p className="text-[11px] text-ink-faint mt-0.5">
                Define how your agent behaves
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-faint hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
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
              placeholder="You are a helpful assistant that…"
              disabled={aiLoading}
              rows={12}
              className={`w-full border font-mono text-sm leading-relaxed px-4 py-3 placeholder:text-ink-faint focus:outline-none resize-none transition-colors disabled:opacity-60 bg-surface ${
                hasSuggestion
                  ? "border-accent text-ink bg-accent-soft/20"
                  : "border-rule text-ink focus:border-rule-strong"
              }`}
            />
            {aiLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
                <div className="flex items-center gap-2.5 px-4 py-2.5 border border-rule bg-surface shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-ink-muted" strokeWidth={1.5} />
                  <span className="text-xs text-ink-muted">Generating improved prompt…</span>
                </div>
              </div>
            )}
          </div>

          {/* Suggestion action bar */}
          {hasSuggestion && (
            <div className="flex items-center justify-between border border-accent/40 bg-accent-soft/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                <span className="text-xs text-ink-muted">
                  AI suggestion — review and accept or dismiss
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={dismissSuggestion}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
                >
                  <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
                  Dismiss
                </button>
                <button
                  onClick={acceptSuggestion}
                  className="inline-flex items-center gap-1.5 text-xs bg-ink text-surface px-3 py-1.5 hover:opacity-90 transition-all"
                >
                  <Check className="h-3 w-3" strokeWidth={2} />
                  Accept
                </button>
              </div>
            </div>
          )}

          {/* AI Assistant */}
          <div className="border border-rule bg-surface-sunken p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
              <span className="eyebrow">AI Prompt Assistant</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleAiAssist(action)}
                  disabled={aiLoading}
                  className="text-[11px] px-2.5 py-1 border border-rule text-ink-faint hover:text-ink hover:border-rule-strong disabled:opacity-40 transition-all"
                >
                  {action}
                </button>
              ))}
            </div>

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
                    ? "Describe how to improve this prompt…"
                    : "Describe what your agent should do…"
                }
                className="w-full border border-rule bg-surface pl-4 pr-12 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-rule-strong disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={!aiInput.trim() || aiLoading}
                className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center transition-all ${
                  aiInput.trim() && !aiLoading
                    ? "bg-ink text-surface hover:opacity-90"
                    : "bg-surface-sunken text-ink-faint border border-rule"
                }`}
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-rule shrink-0">
          <span className="font-mono text-[11px] text-ink-faint">
            {draft.length} characters
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={hasSuggestion}
              className="inline-flex items-center gap-1.5 text-xs bg-ink text-surface px-4 py-2 font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <Save className="h-3 w-3" strokeWidth={1.75} />
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
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "OpenAI flagship multimodal model",
    provider: "OpenAI",
    tier: "$$$",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Fast and affordable OpenAI model",
    provider: "OpenAI",
    tier: "$",
  },
  {
    id: "o4-mini",
    name: "o4-mini",
    description: "OpenAI fast reasoning model",
    provider: "OpenAI",
    tier: "$$",
  },
];

function EnabledModelsSection({ agent }: { agent: Doc<"agents"> }) {
  const updateAgent = useMutation(api.agents.update);

  const aiProviders = useQuery(api.credentials.listAiProviders);
  const PROVIDER_TO_CRED: Record<string, string> = {
    Anthropic: "anthropic",
    Google: "google_ai",
    OpenAI: "openai",
  };
  const availableModels = aiProviders && aiProviders.length > 0
    ? ALL_MODELS.filter((m) => {
        const credType = PROVIDER_TO_CRED[m.provider];
        return credType ? aiProviders.includes(credType) : true;
      })
    : ALL_MODELS;

  const enabledModels = (agent.enabledModels ?? ALL_MODELS.map((m) => m.id))
    .filter((id) => availableModels.some((m) => m.id === id));

  async function handleToggle(modelId: string) {
    const isCurrentModel = agent.model === modelId;
    const isEnabled = enabledModels.includes(modelId);

    if (isEnabled && isCurrentModel) return;
    if (isEnabled && enabledModels.length <= 1) return;

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
    <section className="border border-rule bg-surface">
      <div className="flex items-baseline justify-between px-6 pt-6 pb-4 border-b border-rule">
        <p className="eyebrow">Enabled Models</p>
        <span className="font-mono text-xs text-ink-faint">
          {enabledModels.length} of {availableModels.length}
        </span>
      </div>
      {aiProviders && aiProviders.length > 0 && availableModels.length < ALL_MODELS.length && (
        <p className="px-6 pt-3 text-xs text-ink-faint">
          Add AI provider credentials to unlock more models.
        </p>
      )}
      <ol className="divide-y divide-rule">
        {availableModels.map((m) => {
          const enabled = enabledModels.includes(m.id);
          const isCurrentModel = agent.model === m.id;
          const cantDisable = enabled && (isCurrentModel || enabledModels.length <= 1);
          return (
            <li key={m.id}>
              <button
                onClick={() => handleToggle(m.id)}
                disabled={cantDisable}
                className={`w-full flex items-center gap-4 px-6 py-3.5 text-left transition-colors ${
                  enabled ? "bg-surface-sunken/60" : "hover:bg-surface-sunken/40"
                } ${cantDisable ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <Toggle on={enabled} onToggle={() => {}} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${enabled ? "text-ink" : "text-ink-muted"}`}>
                      {m.name}
                    </span>
                    <span className={`font-mono text-[10px] ${
                      m.tier === "$$$" ? "text-warn" : "text-ink-faint"
                    }`}>
                      {m.tier}
                    </span>
                    {isCurrentModel && (
                      <span className="eyebrow text-accent">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-faint">{m.description}</p>
                </div>
                <span className="text-[10px] text-ink-faint">{m.provider}</span>
              </button>
            </li>
          );
        })}
      </ol>
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
          <div className="flex items-center gap-3 mb-2">
            <p className="eyebrow">{category.title}</p>
            <div className="flex-1 h-px bg-rule" />
          </div>
          <ol className="divide-y divide-rule border-y border-rule">
            {category.items.map((item) => {
              const enabled = enabledSets.includes(item.key);
              return (
                <li key={item.key}>
                  <button
                    onClick={() => onToggle(item.key)}
                    className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                      enabled ? "bg-surface-sunken/60" : "hover:bg-surface-sunken/40"
                    }`}
                  >
                    <Toggle on={enabled} onToggle={() => {}} />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${enabled ? "text-ink" : "text-ink-muted"}`}>
                        {item.label}
                      </span>
                      <p className="text-[11px] text-ink-faint line-clamp-1">
                        {item.description}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
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
      await updateAgent({ agentId: agent._id, enabledToolSets: newSets });
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
    <section className="border border-rule bg-surface">
      <div className="flex items-baseline justify-between px-6 pt-6 pb-4 border-b border-rule">
        <p className="eyebrow">Capabilities</p>
        <span className="font-mono text-xs text-ink-faint">{enabledSets.length} active</span>
      </div>
      <div className="p-6">
        <ToolSetCategoryGrid
          categories={CAPABILITY_CATEGORIES}
          enabledSets={enabledSets}
          onToggle={handleToggle}
        />
      </div>
    </section>
  );
}

// ── Integrations Section ─────────────────────────────────────────────

function IntegrationsSection({ agent }: { agent: Doc<"agents"> }) {
  const { enabledSets, handleToggle } = useToolSetToggle(agent);

  const activeCount = enabledSets.filter((s) =>
    INTEGRATION_CATEGORIES.some((c) => c.items.some((i) => i.key === s))
  ).length;

  return (
    <section className="border border-rule bg-surface">
      <div className="flex items-baseline justify-between px-6 pt-6 pb-4 border-b border-rule">
        <p className="eyebrow">Integrations</p>
        <span className="font-mono text-xs text-ink-faint">{activeCount} active</span>
      </div>
      <div className="p-6">
        <ToolSetCategoryGrid
          categories={INTEGRATION_CATEGORIES}
          enabledSets={enabledSets}
          onToggle={handleToggle}
        />
      </div>
    </section>
  );
}

// ── Shared bot section helpers ────────────────────────────────────────

function SaveButton({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="inline-flex items-center gap-1.5 text-xs bg-ink text-surface px-4 py-2 font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
    >
      {saving ? (
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
      ) : saved ? (
        <Check className="h-3 w-3" strokeWidth={2} />
      ) : (
        <Save className="h-3 w-3" strokeWidth={1.75} />
      )}
      {saved ? "Saved" : "Save"}
    </button>
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
    <section className="border border-rule bg-surface">
      <div className="px-6 pt-6 pb-4 border-b border-rule">
        <p className="eyebrow">Discord Bot (Two-Way Chat)</p>
        <p className="mt-1 text-xs text-ink-faint">
          @mention the bot in Discord to route messages through this agent.
        </p>
      </div>
      <form onSubmit={handleSave} className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Enable Discord Bot</span>
          <Toggle on={enabled} onToggle={() => setEnabled(!enabled)} />
        </div>

        {enabled && (
          <>
            <Field label="Bot Prompt">
              <textarea
                value={botPrompt}
                onChange={(e) => setBotPrompt(e.target.value)}
                placeholder="You are a helpful assistant…"
                rows={4}
                className={textareaClass}
              />
              <p className="mt-1 text-[10px] text-ink-faint">
                Used for non-authorized users. Leave blank to use the agent's system prompt.
              </p>
            </Field>

            <Field label="Bot Model (optional)">
              <select
                value={botModel}
                onChange={(e) => setBotModel(e.target.value)}
                className={selectClass}
              >
                <option value="">
                  Use agent's default ({ALL_MODELS.find((m) => m.id === agent.model)?.name ?? agent.model})
                </option>
                {(agent.enabledModels ?? ALL_MODELS.map((m) => m.id)).map((modelId) => {
                  const model = ALL_MODELS.find((m) => m.id === modelId);
                  return (
                    <option key={modelId} value={modelId}>
                      {model ? `${model.name} — ${model.description}` : modelId}
                    </option>
                  );
                })}
              </select>
            </Field>

            <div className="space-y-2">
              <p className="eyebrow">Authorized Discord Usernames</p>
              <p className="text-xs text-ink-faint">
                These users get full agent access when they @mention the bot.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUser())}
                  placeholder="discord_username"
                  className="flex-1 bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={addUser}
                  className="text-xs text-ink-muted hover:text-ink border border-rule px-3 py-1 transition-colors"
                >
                  Add
                </button>
              </div>
              {authorizedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {authorizedUsers.map((u) => (
                    <span
                      key={u}
                      className="flex items-center gap-1 border border-rule bg-surface-sunken text-xs px-2.5 py-1"
                    >
                      {u}
                      <button
                        type="button"
                        onClick={() => removeUser(u)}
                        className="text-ink-faint hover:text-danger transition-colors ml-1"
                      >
                        <X className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
    <section className="border border-rule bg-surface">
      <div className="px-6 pt-6 pb-4 border-b border-rule">
        <p className="eyebrow">Slack Bot (Two-Way Chat)</p>
        <p className="mt-1 text-xs text-ink-faint">
          @mention or DM the bot to route messages through this agent. Requires Socket Mode and an App-Level Token.
        </p>
      </div>
      <form onSubmit={handleSave} className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Enable Slack Bot</span>
          <Toggle on={enabled} onToggle={() => setEnabled(!enabled)} />
        </div>

        {enabled && (
          <>
            <Field label="Bot Prompt">
              <textarea
                value={botPrompt}
                onChange={(e) => setBotPrompt(e.target.value)}
                placeholder="You are a helpful assistant…"
                rows={4}
                className={textareaClass}
              />
              <p className="mt-1 text-[10px] text-ink-faint">
                Used for non-authorized Slack users. Leave blank to use the agent's system prompt.
              </p>
            </Field>

            <Field label="Bot Model (optional)">
              <select
                value={botModel}
                onChange={(e) => setBotModel(e.target.value)}
                className={selectClass}
              >
                <option value="">
                  Use agent's default ({ALL_MODELS.find((m) => m.id === agent.model)?.name ?? agent.model})
                </option>
                {(agent.enabledModels ?? ALL_MODELS.map((m) => m.id)).map((modelId) => {
                  const model = ALL_MODELS.find((m) => m.id === modelId);
                  return (
                    <option key={modelId} value={modelId}>
                      {model ? `${model.name} — ${model.description}` : modelId}
                    </option>
                  );
                })}
              </select>
            </Field>

            <div className="space-y-2">
              <p className="eyebrow">Authorized Slack User IDs</p>
              <p className="text-xs text-ink-faint">
                Slack user IDs (e.g.{" "}
                <code className="font-mono bg-surface-sunken px-1">U0AR2KKC2Q3</code>
                ) get full agent access.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUser())}
                  placeholder="U01234ABCDE"
                  className="flex-1 font-mono bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={addUser}
                  className="text-xs text-ink-muted hover:text-ink border border-rule px-3 py-1 transition-colors"
                >
                  Add
                </button>
              </div>
              {authorizedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {authorizedUsers.map((u) => (
                    <span
                      key={u}
                      className="flex items-center gap-1 border border-rule bg-surface-sunken font-mono text-xs px-2.5 py-1"
                    >
                      {u}
                      <button
                        type="button"
                        onClick={() => removeUser(u)}
                        className="text-ink-faint hover:text-danger transition-colors ml-1"
                      >
                        <X className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>
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
    <section className="border border-rule bg-surface">
      <div className="flex items-baseline justify-between px-6 pt-6 pb-4 border-b border-rule">
        <p className="eyebrow">
          Custom HTTP Tools
          {tools && (
            <span className="ml-2 font-mono font-normal text-ink-faint">{tools.length}</span>
          )}
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <Plus className="h-3 w-3" strokeWidth={1.75} />
          Add Tool
        </button>
      </div>

      {showAdd && (
        <div className="border-b border-rule p-6 space-y-4 bg-surface-sunken">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tool Name">
              <input
                type="text"
                value={newTool.name}
                onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                placeholder="get_weather"
                className={inputClass}
              />
            </Field>
            <Field label="HTTP Method">
              <select
                value={newTool.method}
                onChange={(e) => setNewTool({ ...newTool, method: e.target.value as any })}
                className={selectClass}
              >
                {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Endpoint URL">
            <input
              type="text"
              value={newTool.endpoint}
              onChange={(e) => setNewTool({ ...newTool, endpoint: e.target.value })}
              placeholder="https://api.example.com/data"
              className={monoInputClass}
            />
          </Field>
          <Field label="Description">
            <input
              type="text"
              value={newTool.description}
              onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
              placeholder="What does this tool do?"
              className={inputClass}
            />
          </Field>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleCreate}
              disabled={!newTool.name.trim() || !newTool.endpoint.trim()}
              className="text-xs bg-ink text-surface px-3 py-1.5 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
            >
              Add Tool
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-xs text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {tools === undefined ? (
        <div className="p-6 space-y-[1px]">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-surface-sunken animate-pulse" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <p className="px-6 py-8 text-sm text-ink-faint">
          No custom tools. Add HTTP endpoints for your agent to call during conversations.
        </p>
      ) : (
        <ol className="divide-y divide-rule">
          {tools.map((tool) => (
            <li key={tool._id} className="group flex items-center justify-between px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase bg-surface-sunken border border-rule px-1.5 py-0.5 text-ink-muted">
                    {tool.method}
                  </span>
                  <span className="text-sm text-ink">{tool.name}</span>
                </div>
                <p className="font-mono text-xs text-ink-faint mt-0.5 truncate max-w-md">
                  {tool.endpoint}
                </p>
              </div>
              <button
                onClick={() => removeTool({ toolId: tool._id })}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-faint hover:text-danger focus:opacity-100 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ol>
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
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const { storageId } = await result.json();

      const documentId = await uploadDoc({
        agentId: agent._id,
        fileName: file.name,
        fileType,
        storageId,
        fileSize: file.size,
      });

      const storageUrl = await getStorageUrl.query(api.storage.getUrl, { storageId });

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
    uploading: "text-warn",
    processing: "text-accent",
    ready: "text-accent",
    error: "text-danger",
  };

  const statusLabels: Record<string, string> = {
    uploading: "Uploading…",
    processing: "Processing…",
    ready: "Ready",
    error: "Error",
  };

  return (
    <section className="border border-rule bg-surface">
      <div className="flex items-baseline justify-between px-6 pt-6 pb-4 border-b border-rule">
        <p className="eyebrow">
          Knowledge Base
          {documents && (
            <span className="ml-2 font-mono font-normal text-ink-faint">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </span>
          )}
        </p>
        <label
          className={`inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold cursor-pointer transition-colors ${
            uploading ? "text-ink-faint" : "text-ink-muted hover:text-ink"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
          ) : (
            <Upload className="h-3 w-3" strokeWidth={1.5} />
          )}
          {uploading ? "Uploading…" : "Upload Document"}
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
        <div className="p-6 space-y-[1px]">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-surface-sunken animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <p className="px-6 py-8 text-sm text-ink-faint">
          No documents uploaded. Upload PDF, TXT, MD, DOCX, CSV, or image files for
          your agent to search during conversations.
        </p>
      ) : (
        <ol className="divide-y divide-rule">
          {documents.map((doc) => (
            <li key={doc._id} className="group flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[10px] uppercase bg-surface-sunken border border-rule px-1.5 py-0.5 text-ink-muted shrink-0">
                  {doc.fileType}
                </span>
                <div className="min-w-0">
                  <span className="text-sm text-ink truncate block">{doc.fileName}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] ${statusColors[doc.status] ?? "text-ink-faint"}`}>
                      {doc.status === "processing" && (
                        <Loader2 className="h-2.5 w-2.5 animate-spin inline mr-1" strokeWidth={1.5} />
                      )}
                      {statusLabels[doc.status] ?? doc.status}
                    </span>
                    {doc.chunkCount && (
                      <span className="font-mono text-[10px] text-ink-faint">
                        {doc.chunkCount} chunks
                      </span>
                    )}
                    {doc.error && (
                      <span className="text-[10px] text-danger truncate max-w-48">
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-faint hover:text-warn focus:opacity-100 transition-all"
                    title="Retry processing"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                )}
                <button
                  onClick={() => removeDoc({ documentId: doc._id })}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-faint hover:text-danger focus:opacity-100 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
