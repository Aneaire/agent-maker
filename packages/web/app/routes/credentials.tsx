import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  CREDENTIAL_TYPE_REGISTRY,
  type CredentialTypeDef,
} from "@agent-maker/shared/src/credential-types";
import { DashboardLayout } from "~/components/DashboardLayout";
import { useState, useEffect } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Zap,
  Loader2,
  Check,
  X,
  Save,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Route } from "./+types/credentials";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Credentials — Agent Maker" }];
}

export default function CredentialsPage() {
  const credentials = useQuery(api.credentials.list);
  const removeCredential = useMutation(api.credentials.remove);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("resend");

  // Check for OAuth callback params
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth === "success") {
      setOauthMessage("Google account connected successfully!");
      window.history.replaceState({}, "", "/credentials");
    } else if (oauth === "error") {
      setOauthMessage(`OAuth error: ${params.get("message") ?? "unknown"}`);
      window.history.replaceState({}, "", "/credentials");
    }
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this credential? It will be unlinked from all agents.")) return;
    await removeCredential({ credentialId: id as Id<"credentials"> });
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-zinc-400" />
            <h1 className="text-lg font-semibold">Credentials</h1>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Credential
          </button>
        </div>

        {oauthMessage && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              oauthMessage.includes("error")
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-green-500/30 bg-green-500/10 text-green-300"
            }`}
          >
            {oauthMessage}
            <button
              onClick={() => setOauthMessage(null)}
              className="ml-2 text-xs underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        <p className="text-sm text-zinc-500">
          Manage API keys and OAuth connections. Link credentials to agents in
          each agent's settings page.
        </p>

        <MigrateLegacySection />

        {/* Create new credential */}
        {showCreate && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-sm font-medium">Create Credential</h2>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Type</label>
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none pr-8"
                >
                  {Object.values(CREDENTIAL_TYPE_REGISTRY).map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label} — {t.description}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
              </div>
            </div>
            <StandaloneCredentialForm
              typeDef={CREDENTIAL_TYPE_REGISTRY[selectedType]!}
              onCreated={() => setShowCreate(false)}
              onCancel={() => setShowCreate(false)}
            />
          </section>
        )}

        {/* List existing credentials */}
        {credentials === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : credentials.length === 0 && !showCreate ? (
          <div className="text-center py-12 text-zinc-500 text-sm">
            No credentials yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {credentials.map((cred) => (
              <div
                key={cred._id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cred.name}</span>
                      <StatusBadge status={cred.status} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {CREDENTIAL_TYPE_REGISTRY[cred.type]?.label ?? cred.type}
                      {cred.lastTestedAt && (
                        <>
                          {" · "}Last tested{" "}
                          {new Date(cred.lastTestedAt).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TestButton credentialId={cred._id as Id<"credentials">} />
                  <button
                    onClick={() => handleDelete(cred._id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Standalone credential form (not linked to an agent) ─────────────

// ── Migrate Legacy Configs ────────────────────────────────────────────

function MigrateLegacySection() {
  const migrateFromLegacy = useAction(api.credentialActions.migrateFromLegacy);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<{
    migrated: number;
    linked: number;
    skipped: number;
  } | null>(null);

  async function handleMigrate() {
    if (!confirm("This will import existing agent tool configs into the new credential system. Continue?")) return;
    setMigrating(true);
    try {
      const res = await migrateFromLegacy({});
      setResult(res);
    } catch (err: any) {
      alert(`Migration error: ${err.message}`);
    }
    setMigrating(false);
  }

  if (result) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
        Migration complete: {result.migrated} credential(s) created, {result.linked} link(s) established, {result.skipped} skipped.
        <button
          onClick={() => setResult(null)}
          className="ml-2 text-xs underline opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Migrate Legacy Configs</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Import existing agent tool configurations into the new credential system.
        </p>
      </div>
      <button
        onClick={handleMigrate}
        disabled={migrating}
        className="flex items-center gap-1.5 text-xs bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-lg font-medium hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {migrating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {migrating ? "Migrating..." : "Migrate"}
      </button>
    </div>
  );
}

// ── Standalone credential form (not linked to an agent) ─────────────

function StandaloneCredentialForm({
  typeDef,
  onCreated,
  onCancel,
}: {
  typeDef: CredentialTypeDef;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const createCredential = useAction(api.credentialActions.create);
  const startOAuth = useAction(api.credentialActions.startOAuth);
  const [name, setName] = useState(`My ${typeDef.label}`);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of typeDef.fields) init[f.key] = "";
    return init;
  });
  const [saving, setSaving] = useState(false);

  // Reset fields when type changes
  useEffect(() => {
    setName(`My ${typeDef.label}`);
    const init: Record<string, string> = {};
    for (const f of typeDef.fields) init[f.key] = "";
    setFields(init);
  }, [typeDef.type]);

  if (typeDef.authMethod === "oauth2") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-zinc-500">{typeDef.description}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setSaving(true);
              try {
                const { authUrl } = await startOAuth({
                  provider: typeDef.type,
                  scopes: typeDef.oauth2!.scopes,
                });
                window.location.href = authUrl;
              } catch (err: any) {
                alert(err.message);
                setSaving(false);
              }
            }}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ExternalLink className="h-3 w-3" />
            )}
            {saving ? "Redirecting..." : `Connect ${typeDef.label}`}
          </button>
          <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const requiredFilled = typeDef.fields
    .filter((f) => f.required)
    .every((f) => fields[f.key]?.trim());

  async function handleSave() {
    if (!requiredFilled || !name.trim()) return;
    setSaving(true);
    try {
      await createCredential({ name: name.trim(), type: typeDef.type, data: fields });
      onCreated();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">Name</label>
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
            {!field.required && <span className="text-zinc-600 ml-1">(optional)</span>}
          </label>
          <input
            type={field.type === "password" ? "password" : "text"}
            value={fields[field.key]}
            onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          {field.helpText && <p className="text-[11px] text-zinc-600 mt-1">{field.helpText}</p>}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !requiredFilled || !name.trim()}
          className="flex items-center gap-1.5 text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {saving ? "Saving..." : "Create"}
        </button>
        <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  );
}

function TestButton({ credentialId }: { credentialId: Id<"credentials"> }) {
  const testCredential = useAction(api.credentialActions.test);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; error?: string } | null>(null);

  return (
    <button
      onClick={async () => {
        setTesting(true);
        setResult(null);
        try {
          const res = await testCredential({ credentialId });
          setResult(res);
        } catch (err: any) {
          setResult({ valid: false, error: err.message });
        }
        setTesting(false);
        setTimeout(() => setResult(null), 5000);
      }}
      disabled={testing}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-800"
      title={result?.error ?? "Test credential"}
    >
      {testing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : result?.valid ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : result && !result.valid ? (
        <X className="h-3 w-3 text-red-400" />
      ) : (
        <Zap className="h-3 w-3" />
      )}
      {testing ? "Testing..." : result?.valid ? "Valid" : result ? "Failed" : "Test"}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    valid: { color: "text-green-400 bg-green-400/10 border-green-400/20", label: "Valid" },
    untested: { color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20", label: "Untested" },
    invalid: { color: "text-red-400 bg-red-400/10 border-red-400/20", label: "Invalid" },
  }[status] ?? { color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20", label: status };

  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
