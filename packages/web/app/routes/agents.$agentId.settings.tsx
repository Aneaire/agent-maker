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
  ToggleLeft,
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
  Mail,
} from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect, useRef } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

const TOOL_SET_INFO: Record<
  string,
  { label: string; description: string }
> = {
  memory: {
    label: "Memory",
    description: "Store and recall information across conversations",
  },
  web_search: {
    label: "Web Search",
    description: "Search the internet and fetch web pages",
  },
  pages: {
    label: "Pages",
    description: "Create and manage task boards, notes, spreadsheets, and markdown pages",
  },
  rag: {
    label: "Knowledge Base",
    description: "Upload documents and let your agent search them",
  },
  email: {
    label: "Email",
    description: "Send emails via Resend to users and contacts",
  },
  custom_http_tools: {
    label: "Custom HTTP Tools",
    description: "Call external APIs configured below",
  },
  schedules: {
    label: "Scheduled Actions",
    description: "Create recurring or one-time scheduled tasks (cron jobs, intervals)",
  },
  automations: {
    label: "Automations",
    description: "Event-driven rules: when X happens → do Y automatically",
  },
  timers: {
    label: "Timers & Delays",
    description: "Set delayed actions for follow-ups, reminders, and drip sequences",
  },
  webhooks: {
    label: "Webhooks",
    description: "Fire outgoing webhooks to external services and view event history",
  },
  agent_messages: {
    label: "Inter-Agent Messaging",
    description: "Communicate with other agents for delegation and coordination",
  },
};

const AGENT_SERVER_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : "http://localhost:3001";

export default function SettingsPage() {
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-zinc-400" />
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
          <Link
            to={`/agents/${agent._id}/editor`}
            className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <Wand2 className="h-4 w-4" />
            Edit with AI
          </Link>
        </div>

        <AgentIconSection agent={agent} />
        <AgentConfigSection agent={agent} />
        <ToolSetsSection agent={agent} />
        {(agent.enabledToolSets ?? []).includes("rag") && (
          <DocumentsSection agent={agent} />
        )}
        {(agent.enabledToolSets ?? []).includes("email") && (
          <EmailConfigSection agent={agent} />
        )}
        <CustomToolsSection agent={agent} />
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
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
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
  const [model, setModel] = useState(agent.model);
  const [saving, setSaving] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description ?? "");
    setSystemPrompt(agent.systemPrompt);
    setModel(agent.model);
  }, [agent]);

  const hasChanges =
    name !== agent.name ||
    description !== (agent.description ?? "") ||
    systemPrompt !== agent.systemPrompt ||
    model !== agent.model;

  async function handleSave() {
    setSaving(true);
    try {
      await updateAgent({
        agentId: agent._id,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        model: model || undefined,
      });
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  return (
    <>
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
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

          <Field label="Model">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            >
              <optgroup label="Claude (Anthropic)">
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (balanced)</option>
                <option value="claude-opus-4-6">Claude Opus 4.6 (most capable)</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest)</option>
              </optgroup>
              <optgroup label="Gemini (Google)">
                <option value="gemini-3.1-pro">Gemini 3.1 Pro (most capable)</option>
                <option value="gemini-3-flash">Gemini 3 Flash (fast, agentic)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (cheapest)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (balanced)</option>
              </optgroup>
            </select>
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
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-100 text-zinc-900 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
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

// ── Tool Sets Toggle ──────────────────────────────────────────────────

function ToolSetsSection({ agent }: { agent: Doc<"agents"> }) {
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

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center gap-2 mb-5">
        <ToggleRight className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-medium">Enabled Capabilities</h2>
      </div>
      <div className="space-y-3">
        {Object.entries(TOOL_SET_INFO).map(([key, info]) => {
          const enabled = enabledSets.includes(key);
          return (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className="w-full flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
            >
              <div>
                <span className="text-sm font-medium">{info.label}</span>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {info.description}
                </p>
              </div>
              {enabled ? (
                <ToggleRight className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-zinc-600 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Email Config ──────────────────────────────────────────────────────

function EmailConfigSection({ agent }: { agent: Doc<"agents"> }) {
  const existingConfig = useQuery(api.agents.getToolConfig, {
    agentId: agent._id,
    toolSetName: "email",
  });
  const saveConfig = useMutation(api.agents.saveToolConfig);
  const [resendApiKey, setResendApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existingConfig && !loaded) {
      setResendApiKey(existingConfig.resendApiKey ?? "");
      setFromEmail(existingConfig.fromEmail ?? "");
      setFromName(existingConfig.fromName ?? "");
      setLoaded(true);
    }
  }, [existingConfig, loaded]);

  const hasChanges =
    loaded &&
    (resendApiKey !== (existingConfig?.resendApiKey ?? "") ||
      fromEmail !== (existingConfig?.fromEmail ?? "") ||
      fromName !== (existingConfig?.fromName ?? ""));

  async function handleSave() {
    if (!resendApiKey.trim() || !fromEmail.trim()) return;
    setSaving(true);
    try {
      await saveConfig({
        agentId: agent._id,
        toolSetName: "email",
        config: {
          resendApiKey: resendApiKey.trim(),
          fromEmail: fromEmail.trim(),
          fromName: fromName.trim() || undefined,
        },
      });
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-medium">Email Configuration</h2>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving || !resendApiKey.trim() || !fromEmail.trim()}
            className="flex items-center gap-1.5 text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            <Save className="h-3 w-3" />
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <Field label="Resend API Key">
          <input
            type="password"
            value={resendApiKey}
            onChange={(e) => setResendApiKey(e.target.value)}
            placeholder="re_..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </Field>

        <Field label="From Email">
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="agent@yourdomain.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </Field>

        <Field label="From Name (optional)">
          <input
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="My Agent"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </Field>

        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Get your API key from{" "}
          <a
            href="https://resend.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 underline hover:text-zinc-300"
          >
            resend.com
          </a>
          . You'll need to verify a sending domain to use a custom from address.
        </p>
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
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
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
    ready: "text-emerald-400",
    error: "text-red-400",
  };

  const statusLabels: Record<string, string> = {
    uploading: "Uploading...",
    processing: "Processing...",
    ready: "Ready",
    error: "Error",
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
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
