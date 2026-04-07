import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  CREDENTIAL_TYPE_REGISTRY,
  type CredentialTypeDef,
} from "@agent-maker/shared/src/credential-types";
import { DashboardLayout } from "~/components/DashboardLayout";
import { useState, useEffect, useRef } from "react";
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
  Image,
  Pencil,
} from "lucide-react";
import type { Id } from "@agent-maker/shared/convex/_generated/dataModel";
import type { Route } from "./+types/credentials";

// ── Service brand icons ──────────────────────────────────────────────

function ServiceIcon({ type, className = "h-4 w-4" }: { type: string; className?: string }) {
  switch (type) {
    case "resend":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" fill="#000" />
          <path d="m2 6 10 7L22 6" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "slack":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52ZM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313Z" fill="#E01E5A" />
          <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834ZM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312Z" fill="#36C5F0" />
          <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834ZM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312Z" fill="#2EB67D" />
          <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52ZM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313Z" fill="#ECB22E" />
        </svg>
      );
    case "notion":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.49 2.45c-.42-.326-.98-.7-2.055-.607L3.62 2.917c-.466.046-.56.28-.374.466l1.213.825Zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.934-.56.934-1.166V6.382c0-.606-.233-.933-.747-.886l-15.177.887c-.56.046-.747.326-.747.886v.02Zm14.337.42c.094.42 0 .84-.42.887l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.934-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.747-.932l3.222-.187Z" fill="currentColor" />
        </svg>
      );
    case "google_oauth2":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
        </svg>
      );
    case "image_gen_gemini":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Z" fill="#8E75B2" />
          <path d="m12 4.8-1.4 3.8-3.8 1.4 3.8 1.4L12 15.2l1.4-3.8 3.8-1.4-3.8-1.4L12 4.8Z" fill="#fff" />
          <path d="m17.6 13.6-.8 2-2 .8 2 .8.8 2 .8-2 2-.8-2-.8-.8-2Z" fill="#fff" opacity=".7" />
        </svg>
      );
    case "image_gen_nano_banana":
      return <Image className={className} />;
    default:
      return <KeyRound className={className} />;
  }
}

// ── Custom type selector dropdown ────────────────────────────────────

function CredentialTypeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (type: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = CREDENTIAL_TYPE_REGISTRY[value];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-left hover:border-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
      >
        <ServiceIcon type={value} className="h-5 w-5 shrink-0" />
        <span className="flex-1 truncate">
          {selected?.label} <span className="text-zinc-500">— {selected?.description}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl overflow-hidden">
          {Object.values(CREDENTIAL_TYPE_REGISTRY).map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => {
                onChange(t.type);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-zinc-700 transition-colors ${
                t.type === value ? "bg-zinc-700/50" : ""
              }`}
            >
              <ServiceIcon type={t.type} className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{t.label}</div>
                <div className="text-xs text-zinc-500 truncate">{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Credentials — HiGantic" }];
}

export default function CredentialsPage() {
  const credentials = useQuery(api.credentials.list);
  const removeCredential = useMutation(api.credentials.remove);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("resend");
  const [editingId, setEditingId] = useState<string | null>(null);

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
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
              <KeyRound className="h-4 w-4 text-zinc-300" />
            </div>
            <h1 className="text-lg font-semibold">Credentials</h1>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-lg bg-neon-400 px-3.5 py-2 text-sm font-medium text-zinc-950 hover:bg-neon-300 transition-colors glow-neon-sm"
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
          <section className="rounded-xl border border-zinc-800/60 glass-card p-6 space-y-4 fade-in-up">
            <h2 className="text-sm font-medium">Create Credential</h2>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Type</label>
              <CredentialTypeSelector value={selectedType} onChange={setSelectedType} />
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 mb-5">
              <KeyRound className="h-7 w-7 text-zinc-700" />
            </div>
            <p className="text-zinc-400 font-medium">No credentials yet</p>
            <p className="text-zinc-600 text-sm mt-1">Create one to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {credentials.map((cred) => {
              const isEditing = editingId === cred._id;
              const typeDef = CREDENTIAL_TYPE_REGISTRY[cred.type];
              return (
                <div
                  key={cred._id}
                  className={`group rounded-xl border border-zinc-800/60 glass-card p-4 hover:border-zinc-700/60 transition-all ${isEditing ? "sm:col-span-2" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-zinc-800 border border-zinc-700/50 shrink-0">
                      <ServiceIcon type={cred.type} className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{cred.name}</span>
                        <StatusBadge status={cred.status} />
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {typeDef?.label ?? cred.type}
                      </p>
                      {cred.lastTestedAt && (
                        <p className="text-[10px] text-zinc-600 mt-1">
                          Tested {new Date(cred.lastTestedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {isEditing && typeDef && (
                    <div className="mt-4 pt-4 border-t border-zinc-800/40">
                      <EditCredentialForm
                        credentialId={cred._id as Id<"credentials">}
                        currentName={cred.name}
                        typeDef={typeDef}
                        onDone={() => setEditingId(null)}
                      />
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-zinc-800/40">
                      <TestButton credentialId={cred._id as Id<"credentials">} />
                      {typeDef && typeDef.authMethod !== "oauth2" && (
                        <button
                          onClick={() => setEditingId(cred._id)}
                          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1.5 rounded-lg hover:bg-zinc-800"
                          title="Edit credential"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(cred._id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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

// ── Edit existing credential form ────────────────────────────────────

function EditCredentialForm({
  credentialId,
  currentName,
  typeDef,
  onDone,
}: {
  credentialId: Id<"credentials">;
  currentName: string;
  typeDef: CredentialTypeDef;
  onDone: () => void;
}) {
  const updateCredential = useAction(api.credentialActions.update);
  const getDecrypted = useAction(api.credentialActions.getDecryptedForUser);

  const [name, setName] = useState(currentName);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of typeDef.fields) init[f.key] = "";
    return init;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current values once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDecrypted({ credentialId });
        if (cancelled) return;
        const init: Record<string, string> = {};
        for (const f of typeDef.fields) init[f.key] = (data?.[f.key] ?? "") as string;
        setFields(init);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialId]);

  const requiredFilled = typeDef.fields
    .filter((f) => f.required)
    .every((f) => fields[f.key]?.trim());

  async function handleSave() {
    if (!requiredFilled || !name.trim()) return;
    setSaving(true);
    try {
      await updateCredential({
        credentialId,
        name: name.trim() !== currentName ? name.trim() : undefined,
        data: fields,
      });
      onDone();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading current values…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-400">{error}</p>
        <button onClick={onDone} className="text-xs text-zinc-500 hover:text-zinc-300">
          Close
        </button>
      </div>
    );
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
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button onClick={onDone} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5">
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
    <>
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
    {result && !result.valid && result.error && (
      <p className="text-[10px] text-red-400 mt-1 max-w-[200px] break-words">{result.error}</p>
    )}
    </>
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
