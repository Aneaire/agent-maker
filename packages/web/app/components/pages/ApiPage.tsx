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

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET:    { bg: "bg-accent-soft",         text: "text-accent",        border: "border-accent/30" },
  POST:   { bg: "bg-blue-950/30",         text: "text-blue-400",      border: "border-blue-800/30" },
  PUT:    { bg: "bg-amber-950/30",        text: "text-amber-400",     border: "border-amber-800/30" },
  DELETE: { bg: "bg-red-950/30",          text: "text-red-400",       border: "border-red-800/30" },
  PATCH:  { bg: "bg-purple-950/30",       text: "text-purple-400",    border: "border-purple-800/30" },
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
      ? (import.meta.env.VITE_AGENT_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`)
      : (import.meta.env.VITE_AGENT_SERVER_URL ?? "http://localhost:3001");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-rule px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Globe className="h-4 w-4 text-ink-faint" strokeWidth={1.5} />
          <div>
            <p className="eyebrow">{tab.label}</p>
            {endpoints && (
              <p className="text-[10px] text-ink-faint">
                {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
                {endpoints.filter((e) => e.isActive).length > 0 &&
                  ` · ${endpoints.filter((e) => e.isActive).length} active`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs bg-ink text-surface px-3 py-1.5 font-semibold hover:opacity-90 transition-all"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Endpoint
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* API Keys Section */}
          <section className="border border-rule bg-surface overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-rule">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 border border-rule bg-surface-sunken flex items-center justify-center">
                  <Key className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="eyebrow">API Keys</p>
                  {keys && (
                    <p className="text-[10px] text-ink-faint">
                      {keys.length} key{keys.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowKeyForm(true)}
                className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink-muted px-3 py-1.5 hover:bg-surface-sunken transition-colors"
              >
                <Plus className="h-3 w-3" strokeWidth={1.5} />
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
                <div className="mb-3 border border-warn/30 bg-warn/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warn" strokeWidth={1.5} />
                    <p className="text-xs text-warn font-medium">
                      Copy this key now — it won't be shown again
                    </p>
                  </div>
                  <CopyableCode text={newKey} />
                  <button
                    onClick={() => setNewKey(null)}
                    className="text-xs text-ink-faint mt-2 hover:text-ink-muted transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {keys === undefined ? (
                <div className="divide-y divide-rule">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                      {/* Shield icon: h-3.5 w-3.5 */}
                      <div className="h-3.5 w-3.5 bg-surface-sunken animate-pulse shrink-0" />
                      <div className="flex items-center gap-2">
                        {/* label: text-sm font-medium → h-5 */}
                        <div className="h-5 w-24 bg-surface-sunken animate-pulse" />
                        {/* key prefix: text-xs font-mono → h-[13px] */}
                        <div className="h-[13px] w-20 bg-surface-sunken animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : keys.length > 0 ? (
                <ol className="divide-y divide-rule">
                  {keys.map((k: any) => (
                    <li
                      key={k._id}
                      className="group flex items-center justify-between px-3 py-2.5 hover:bg-surface-sunken/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.5} />
                        <div>
                          <span className="text-sm font-medium text-ink">{k.label}</span>
                          <span className="ml-2 text-xs text-ink-faint font-mono">
                            {k.key.substring(0, 12)}…
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => revokeKey({ keyId: k._id })}
                        className="opacity-0 group-hover:opacity-100 text-xs text-danger hover:text-danger px-2 py-1 hover:bg-danger/5 transition-all"
                      >
                        Revoke
                      </button>
                    </li>
                  ))}
                </ol>
              ) : !showKeyForm ? (
                <p className="text-xs text-ink-faint text-center py-2">
                  Generate an API key to authenticate requests
                </p>
              ) : null
              }
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
                  className="h-28 border border-rule bg-surface-sunken animate-pulse"
                />
              ))}
            </div>
          ) : endpoints.length === 0 && !showAdd ? (
            <div className="text-center py-16">
              <Globe className="h-10 w-10 text-ink-faint mx-auto mb-3" strokeWidth={1} />
              <p className="font-display text-2xl text-ink mb-1">No endpoints yet</p>
              <p className="text-ink-faint text-xs mt-1">
                Create endpoints to expose your agent as a REST API
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-4 flex items-center gap-2 border border-rule px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-sunken transition-colors mx-auto"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
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
      className={`border bg-surface overflow-hidden transition-all ${
        endpoint.isActive
          ? "border-rule"
          : "border-rule opacity-60"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 border font-mono ${mc.bg} ${mc.text} ${mc.border}`}
            >
              {endpoint.method}
            </span>
            <span className="text-sm font-semibold text-ink">{endpoint.name}</span>
            {!endpoint.isActive && (
              <span className="eyebrow text-ink-faint">Disabled</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggle}
              className={`p-1.5 transition-all ${
                endpoint.isActive
                  ? "text-accent hover:bg-accent-soft/30"
                  : "text-ink-faint hover:bg-surface-sunken hover:text-ink-muted"
              }`}
              title={endpoint.isActive ? "Disable" : "Enable"}
            >
              {endpoint.isActive ? (
                <Power className="h-3.5 w-3.5" strokeWidth={1.5} />
              ) : (
                <PowerOff className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-ink-faint hover:text-danger hover:bg-danger/5 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <p className="text-xs text-ink-faint font-mono mb-2 truncate">{url}</p>

        {endpoint.description && (
          <p className="text-xs text-ink-muted leading-relaxed">
            {endpoint.description}
          </p>
        )}
      </div>

      {/* cURL section */}
      <div className="border-t border-rule">
        <button
          onClick={() => setShowCurl(!showCurl)}
          className="flex items-center gap-1.5 w-full px-4 py-2.5 text-[11px] text-ink-faint hover:text-ink-muted hover:bg-surface-sunken/60 transition-colors"
        >
          {showCurl ? (
            <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
          ) : (
            <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
          )}
          cURL example
        </button>

        {showCurl && (
          <div className="px-4 pb-4 group relative">
            <pre className="text-xs text-ink-muted font-mono bg-surface-sunken border border-rule p-3.5 overflow-x-auto whitespace-pre-wrap">
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
    <div className="border border-rule bg-surface p-6 space-y-5">
      <p className="eyebrow">New API Endpoint</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <p className="eyebrow">Endpoint Name</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="get-summary"
            autoFocus
            className="w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="eyebrow">Method</p>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full bg-surface border-0 border-b border-rule-strong pb-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
            >
              {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="eyebrow">Response</p>
            <select
              value={responseFormat}
              onChange={(e) => setResponseFormat(e.target.value as any)}
              className="w-full bg-surface border-0 border-b border-rule-strong pb-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
            >
              <option value="json">JSON</option>
              <option value="text">Text</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="eyebrow">Description</p>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this endpoint does"
          className="w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <p className="eyebrow">
          Prompt Template{" "}
          <span className="text-ink-faint font-normal normal-case tracking-normal">
            (instructions for the agent)
          </span>
        </p>
        <textarea
          value={promptTemplate}
          onChange={(e) => setPromptTemplate(e.target.value)}
          rows={4}
          placeholder="Analyze the incoming data and return a summary…"
          className="w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm font-mono text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none resize-none transition-colors leading-relaxed"
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
          className="text-xs bg-ink text-surface px-4 py-2 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
        >
          Create Endpoint
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-ink-faint px-3 py-2 hover:text-ink-muted hover:bg-surface-sunken transition-colors"
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
        className="flex-1 bg-transparent border-0 border-b border-rule-strong pb-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
        onKeyDown={(e) => {
          if (e.key === "Enter" && label.trim()) onGenerate(label.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        onClick={() => label.trim() && onGenerate(label.trim())}
        disabled={!label.trim()}
        className="text-xs bg-ink text-surface px-3 py-1.5 font-semibold hover:opacity-90 disabled:opacity-30 transition-all"
      >
        Generate
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-ink-faint hover:text-ink-muted px-2 py-1.5 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

function CopyableCode({ text }: { text: string }) {
  return (
    <div className="group relative">
      <pre className="text-xs text-ink-muted font-mono bg-surface-sunken border border-rule p-3 overflow-x-auto">
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
      className="absolute top-2 right-2 p-1.5 bg-surface border border-rule hover:bg-surface-sunken text-ink-faint hover:text-ink-muted transition-all opacity-0 group-hover:opacity-100"
    >
      {copied ? (
        <CheckCheck className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
      )}
    </button>
  );
}
