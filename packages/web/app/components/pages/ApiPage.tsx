import { useQuery, useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  Globe,
  Plus,
  Trash2,
  Key,
  Copy,
  CheckCheck,
  Power,
  PowerOff,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import type { Doc } from "@agent-maker/shared/convex/_generated/dataModel";

const METHOD_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  GET: { bg: "bg-neon-950/50", text: "text-neon-400", ring: "ring-neon-500/20" },
  POST: { bg: "bg-blue-950/50", text: "text-blue-400", ring: "ring-blue-500/20" },
  PUT: { bg: "bg-amber-950/50", text: "text-amber-400", ring: "ring-amber-500/20" },
  DELETE: { bg: "bg-red-950/50", text: "text-red-400", ring: "ring-red-500/20" },
  PATCH: { bg: "bg-purple-950/50", text: "text-purple-400", ring: "ring-purple-500/20" },
};

export function ApiPage({ tab }: { tab: Doc<"sidebarTabs"> }) {
  const endpoints = useQuery(api.tabApiEndpoints.list, { tabId: tab._id });
  const keys = useQuery(api.tabApiEndpoints.listKeys, {
    agentId: tab.agentId,
  });
  const createEndpoint = useMutation(api.tabApiEndpoints.create);
  const updateEndpoint = useMutation(api.tabApiEndpoints.update);
  const removeEndpoint = useMutation(api.tabApiEndpoints.remove);
  const createKey = useMutation(api.tabApiEndpoints.createKey);
  const revokeKey = useMutation(api.tabApiEndpoints.revokeKey);

  const [showAdd, setShowAdd] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : "http://localhost:3001";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
            <Globe className="h-4 w-4 text-zinc-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{tab.label}</h2>
            {endpoints && (
              <p className="text-xs text-zinc-500">
                {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
                {endpoints.filter((e) => e.isActive).length > 0 &&
                  ` · ${endpoints.filter((e) => e.isActive).length} active`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-semibold hover:bg-white transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Endpoint
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* API Keys Section */}
          <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-800/40">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-950/50">
                  <Key className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">API Keys</h3>
                  {keys && (
                    <p className="text-[10px] text-zinc-600">
                      {keys.length} key{keys.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowKeyForm(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Generate
              </button>
            </div>

            <div className="p-4">
              {showKeyForm && (
                <KeyForm
                  onGenerate={async (label) => {
                    const result = await createKey({
                      agentId: tab.agentId,
                      label,
                    });
                    setNewKey(result.key);
                    setShowKeyForm(false);
                  }}
                  onCancel={() => setShowKeyForm(false)}
                />
              )}

              {newKey && (
                <div className="mb-3 rounded-xl border border-amber-900/30 bg-amber-950/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <p className="text-xs text-amber-400 font-medium">
                      Copy this key now — it won't be shown again
                    </p>
                  </div>
                  <CopyableCode text={newKey} />
                  <button
                    onClick={() => setNewKey(null)}
                    className="text-xs text-zinc-500 mt-2 hover:text-zinc-300 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {keys && keys.length > 0 ? (
                <div className="space-y-1.5">
                  {keys.map((k: any) => (
                    <div
                      key={k._id}
                      className="group flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-3.5 w-3.5 text-zinc-600" />
                        <div>
                          <span className="text-sm font-medium">{k.label}</span>
                          <span className="ml-2 text-xs text-zinc-600 font-mono">
                            {k.key.substring(0, 12)}...
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => revokeKey({ keyId: k._id })}
                        className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-950/30 transition-all"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              ) : !showKeyForm ? (
                <p className="text-xs text-zinc-600 text-center py-2">
                  Generate an API key to authenticate requests
                </p>
              ) : null}
            </div>
          </section>

          {/* Endpoints Section */}
          {showAdd && (
            <EndpointForm
              onSave={async (data) => {
                await createEndpoint({ tabId: tab._id, ...data });
                setShowAdd(false);
              }}
              onCancel={() => setShowAdd(false)}
            />
          )}

          {endpoints === undefined ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-zinc-900/30 animate-pulse"
                />
              ))}
            </div>
          ) : endpoints.length === 0 && !showAdd ? (
            <div className="text-center py-16">
              <Globe className="h-12 w-12 text-zinc-800 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">No API endpoints yet</p>
              <p className="text-zinc-600 text-xs mt-1">
                Create endpoints to expose your agent as a REST API
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors mx-auto"
              >
                <Plus className="h-4 w-4" />
                Create Endpoint
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {endpoints.map((ep) => (
                <EndpointCard
                  key={ep._id}
                  endpoint={ep}
                  baseUrl={baseUrl}
                  agentId={tab.agentId}
                  onToggle={() =>
                    updateEndpoint({
                      endpointId: ep._id,
                      isActive: !ep.isActive,
                    })
                  }
                  onDelete={() => removeEndpoint({ endpointId: ep._id })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EndpointCard({
  endpoint,
  baseUrl,
  agentId,
  onToggle,
  onDelete,
}: {
  endpoint: Doc<"tabApiEndpoints">;
  baseUrl: string;
  agentId: any;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [showCurl, setShowCurl] = useState(false);
  const url = `${baseUrl}/api/${agentId}/${endpoint.slug}`;
  const mc = METHOD_COLORS[endpoint.method] ?? METHOD_COLORS.GET;

  const curlExample =
    endpoint.method === "GET"
      ? `curl "${url}" -H "Authorization: Bearer YOUR_API_KEY"`
      : `curl -X ${endpoint.method} "${url}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "hello"}'`;

  return (
    <div
      className={`rounded-2xl border bg-zinc-900/50 overflow-hidden transition-all ${
        endpoint.isActive
          ? "border-zinc-800/60"
          : "border-zinc-800/40 opacity-60"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-md ring-1 ${mc.bg} ${mc.text} ${mc.ring}`}
            >
              {endpoint.method}
            </span>
            <span className="text-sm font-semibold">{endpoint.name}</span>
            {!endpoint.isActive && (
              <span className="text-[10px] text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                Disabled
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggle}
              className={`p-1.5 rounded-lg transition-all ${
                endpoint.isActive
                  ? "text-neon-400 hover:bg-neon-950/30"
                  : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400"
              }`}
              title={endpoint.isActive ? "Disable" : "Enable"}
            >
              {endpoint.isActive ? (
                <Power className="h-3.5 w-3.5" />
              ) : (
                <PowerOff className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-zinc-600 font-mono mb-2 truncate">{url}</p>

        {endpoint.description && (
          <p className="text-xs text-zinc-400 leading-relaxed">
            {endpoint.description}
          </p>
        )}
      </div>

      {/* cURL section */}
      <div className="border-t border-zinc-800/40">
        <button
          onClick={() => setShowCurl(!showCurl)}
          className="flex items-center gap-1.5 w-full px-4 py-2.5 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors"
        >
          {showCurl ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          cURL example
        </button>

        {showCurl && (
          <div className="px-4 pb-4 group relative">
            <pre className="text-xs text-zinc-400 font-mono bg-zinc-950 rounded-xl p-3.5 overflow-x-auto whitespace-pre-wrap border border-zinc-800/40">
              {curlExample}
            </pre>
            <CopyButton text={curlExample} />
          </div>
        )}
      </div>
    </div>
  );
}

function EndpointForm({
  onSave,
  onCancel,
}: {
  onSave: (data: {
    name: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    description?: string;
    promptTemplate: string;
    responseFormat?: "json" | "text";
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [method, setMethod] = useState<
    "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  >("POST");
  const [description, setDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState(
    "Process the following request and return the result."
  );
  const [responseFormat, setResponseFormat] = useState<"json" | "text">(
    "json"
  );

  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-6 space-y-4">
      <h3 className="text-sm font-semibold">New API Endpoint</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Endpoint Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="get-summary"
            autoFocus
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
            >
              {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Response
            </label>
            <select
              value={responseFormat}
              onChange={(e) => setResponseFormat(e.target.value as any)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
            >
              <option value="json">JSON</option>
              <option value="text">Text</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this endpoint does"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Prompt Template{" "}
          <span className="text-zinc-600 font-normal">
            (instructions for the agent)
          </span>
        </label>
        <textarea
          value={promptTemplate}
          onChange={(e) => setPromptTemplate(e.target.value)}
          rows={4}
          placeholder="Analyze the incoming data and return a summary..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-mono placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none resize-none transition-colors leading-relaxed"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onSave({
              name,
              method,
              description: description || undefined,
              promptTemplate,
              responseFormat,
            })
          }
          disabled={!name.trim() || !promptTemplate.trim()}
          className="text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
        >
          Create Endpoint
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-500 px-3 py-2 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function KeyForm({
  onGenerate,
  onCancel,
}: {
  onGenerate: (label: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");

  return (
    <div className="mb-3 flex items-center gap-2">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Key label (e.g. production)"
        autoFocus
        className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
        onKeyDown={(e) => {
          if (e.key === "Enter" && label.trim()) onGenerate(label.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        onClick={() => label.trim() && onGenerate(label.trim())}
        disabled={!label.trim()}
        className="text-xs bg-zinc-100 text-zinc-900 px-3 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
      >
        Generate
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-2"
      >
        Cancel
      </button>
    </div>
  );
}

function CopyableCode({ text }: { text: string }) {
  return (
    <div className="group relative">
      <pre className="text-xs text-zinc-300 font-mono bg-zinc-950 rounded-xl p-3 overflow-x-auto border border-zinc-800/40">
        {text}
      </pre>
      <CopyButton text={text} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all opacity-0 group-hover:opacity-100"
    >
      {copied ? (
        <CheckCheck className="h-3.5 w-3.5 text-neon-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
