import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  type CredentialTypeDef,
  credentialTypesForToolSet,
} from "@agent-maker/shared/src/credential-types";
import { useState } from "react";
import {
  Save,
  Loader2,
  Check,
  X,
  Plus,
  Link2,
  Unlink,
  Zap,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import type { Doc, Id } from "@agent-maker/shared/convex/_generated/dataModel";

interface CredentialManagerProps {
  agent: Doc<"agents">;
  toolSetName: string;
}

export function CredentialManager({ agent, toolSetName }: CredentialManagerProps) {
  const compatibleTypes = credentialTypesForToolSet(toolSetName);
  const allCredentials = useQuery(api.credentials.list);
  const agentLinks = useQuery(api.credentials.listForAgent, { agentId: agent._id });
  const linkToAgent = useMutation(api.credentials.linkToAgent);
  const unlinkFromAgent = useMutation(api.credentials.unlinkFromAgent);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState<string>(
    compatibleTypes[0]?.type ?? ""
  );

  // Find current link for this tool set
  const currentLink = agentLinks?.find((l) => l.toolSetName === toolSetName);

  // Filter credentials compatible with this tool set
  const compatibleCredentials = allCredentials?.filter((c) =>
    compatibleTypes.some((t) => t.type === c.type)
  );

  async function handleLink(credentialId: string) {
    await linkToAgent({
      agentId: agent._id,
      toolSetName,
      credentialId: credentialId as Id<"credentials">,
    });
  }

  async function handleUnlink() {
    await unlinkFromAgent({ agentId: agent._id, toolSetName });
  }

  // If linked, show the linked credential info
  if (currentLink) {
    return (
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-neon-400" />
            <span className="text-sm font-medium">{currentLink.credentialName}</span>
            <StatusBadge status={currentLink.status} />
          </div>
          <div className="flex items-center gap-2">
            <TestCredentialButton credentialId={currentLink.credentialId as Id<"credentials">} />
            <button
              onClick={handleUnlink}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
            >
              <Unlink className="h-3 w-3" />
              Unlink
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Existing credentials selector */}
      {compatibleCredentials && compatibleCredentials.length > 0 && (
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4 space-y-3">
          <p className="text-xs text-zinc-500">Link an existing credential:</p>
          <div className="space-y-2">
            {compatibleCredentials.map((cred) => (
              <button
                key={cred._id}
                onClick={() => handleLink(cred._id)}
                className="w-full flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>{cred.name}</span>
                  <StatusBadge status={cred.status} />
                </div>
                <Link2 className="h-3.5 w-3.5 text-zinc-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create new credential */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Create new credential
        </button>
      ) : (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-4">
          {compatibleTypes.length > 1 && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Credential Type</label>
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none pr-8"
                >
                  {compatibleTypes.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          )}

          {selectedType && (
            <CredentialForm
              typeDef={compatibleTypes.find((t) => t.type === selectedType)!}
              agentId={agent._id}
              toolSetName={toolSetName}
              onCreated={() => setShowCreate(false)}
              onCancel={() => setShowCreate(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Credential Form ──────────────────────────────────────────────────

function CredentialForm({
  typeDef,
  agentId,
  toolSetName,
  onCreated,
  onCancel,
}: {
  typeDef: CredentialTypeDef;
  agentId: Id<"agents">;
  toolSetName: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const createCredential = useAction(api.credentialActions.create);
  const linkToAgent = useMutation(api.credentials.linkToAgent);
  const startOAuth = useAction(api.credentialActions.startOAuth);

  const [name, setName] = useState(`My ${typeDef.label}`);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of typeDef.fields) {
      init[f.key] = "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  // OAuth flow
  if (typeDef.authMethod === "oauth2") {
    return (
      <OAuthConnectButton
        typeDef={typeDef}
        onCancel={onCancel}
      />
    );
  }

  const requiredFilled = typeDef.fields
    .filter((f) => f.required)
    .every((f) => fields[f.key]?.trim());

  async function handleSave() {
    if (!requiredFilled || !name.trim()) return;
    setSaving(true);
    try {
      const credId = await createCredential({
        name: name.trim(),
        type: typeDef.type,
        data: fields,
      });
      await linkToAgent({
        agentId,
        toolSetName,
        credentialId: credId,
      });
      onCreated();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">Credential Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {typeDef.fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs text-zinc-500 mb-1.5">
            {field.label}
            {!field.required && (
              <span className="text-zinc-600 ml-1">(optional)</span>
            )}
          </label>
          {field.type === "select" ? (
            <div className="relative">
              <select
                value={fields[field.key]}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none pr-8"
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            </div>
          ) : (
            <input
              type={field.type === "password" ? "password" : "text"}
              value={fields[field.key]}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          )}
          {field.helpText && (
            <p className="text-[11px] text-zinc-600 mt-1">{field.helpText}</p>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !requiredFilled || !name.trim()}
          className="flex items-center gap-1.5 text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          {saving ? "Saving..." : "Save & Link"}
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── OAuth Connect Button ─────────────────────────────────────────────

function OAuthConnectButton({
  typeDef,
  onCancel,
}: {
  typeDef: CredentialTypeDef;
  onCancel: () => void;
}) {
  const startOAuth = useAction(api.credentialActions.startOAuth);
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    if (!typeDef.oauth2) return;
    setLoading(true);
    try {
      const { authUrl } = await startOAuth({
        provider: typeDef.type,
        scopes: typeDef.oauth2.scopes,
      });
      window.location.href = authUrl;
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {typeDef.description}. Click below to authorize via OAuth.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3" />
          )}
          {loading ? "Redirecting..." : `Connect ${typeDef.label}`}
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Test Credential Button ───────────────────────────────────────────

function TestCredentialButton({ credentialId }: { credentialId: Id<"credentials"> }) {
  const testCredential = useAction(api.credentialActions.test);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; error?: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await testCredential({ credentialId });
      setResult(res);
    } catch (err: any) {
      setResult({ valid: false, error: err.message });
    }
    setTesting(false);
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleTest}
        disabled={testing}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Test credential"
      >
        {testing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Zap className="h-3 w-3" />
        )}
        Test
      </button>
      {result && (
        <span className={`text-xs ${result.valid ? "text-green-400" : "text-red-400"}`}>
          {result.valid ? "Valid" : result.error ?? "Invalid"}
        </span>
      )}
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = {
    valid: { color: "text-green-400 bg-green-400/10 border-green-400/20", icon: Check, label: "Valid" },
    untested: { color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20", icon: null, label: "Untested" },
    invalid: { color: "text-red-400 bg-red-400/10 border-red-400/20", icon: X, label: "Invalid" },
  }[status] ?? { color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20", icon: null, label: status };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${config.color}`}
    >
      {config.icon && <config.icon className="h-2.5 w-2.5" />}
      {config.label}
    </span>
  );
}
