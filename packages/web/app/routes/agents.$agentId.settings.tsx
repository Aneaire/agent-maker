import { useQuery, useMutation } from "convex/react";
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
} from "lucide-react";
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
  custom_http_tools: {
    label: "Custom HTTP Tools",
    description: "Call external APIs configured below",
  },
};

export default function SettingsPage() {
  const { agent } = useOutletContext<{ agent: Doc<"agents"> }>();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-zinc-400" />
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>

        <AgentIconSection agent={agent} />
        <AgentConfigSection agent={agent} />
        <ToolSetsSection agent={agent} />
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
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (balanced)</option>
            <option value="claude-opus-4-6">Claude Opus 4.6 (most capable)</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest)</option>
          </select>
        </Field>

        <Field label="System Prompt">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
          />
        </Field>
      </div>
    </section>
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
