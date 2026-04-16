import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import {
  type CredentialTypeDef,
  credentialTypesForToolSet,
  getCredentialTypeDef,
} from "@agent-maker/shared/src/credential-types";
import { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  Plus,
  Link2,
  Unlink,
  Zap,
  ExternalLink,
  ChevronDown,
  Pencil,
  RefreshCw,
  Check,
  X,
} from "lucide-react";
import type { Doc, Id } from "@agent-maker/shared/convex/_generated/dataModel";

interface CredentialManagerProps {
  agent: Doc<"agents">;
  toolSetName: string;
}

/* ── shared primitives ──────────────────────────────────────────────── */

const inputClass =
  "w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors";
const monoInputClass = inputClass + " font-mono";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="eyebrow">{label}</span>
        {hint && (
          <span className="text-2xs text-ink-faint normal-case tracking-normal font-normal">
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "untested"
      ? "Untested"
      : status.charAt(0).toUpperCase() + status.slice(1);
  const dot =
    status === "valid"
      ? "bg-accent"
      : status === "invalid"
        ? "bg-danger"
        : "bg-rule-strong";

  return (
    <span className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
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
  const [editingLinked, setEditingLinked] = useState(false);

  const currentLink = agentLinks?.find((l) => l.toolSetName === toolSetName);

  const compatibleCredentials = allCredentials?.filter((c) =>
    compatibleTypes.some((t) => t.type === c.type)
  );

  // Loading skeleton — mirrors the linked-state row layout
  if (allCredentials === undefined || agentLinks === undefined) {
    return (
      <div className="bg-surface-sunken/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {/* Link2 icon: h-3.5 w-3.5 */}
            <div className="h-3.5 w-3.5 shrink-0 bg-surface-sunken animate-pulse" />
            {/* name: text-sm font-medium → ~20px line-height */}
            <div className="h-5 w-36 bg-surface-sunken animate-pulse" />
            {/* StatusBadge: dot + text-2xs label */}
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-surface-sunken animate-pulse" />
              <div className="h-[13px] w-14 bg-surface-sunken animate-pulse" />
            </div>
          </div>
          {/* action buttons: text-2xs py-1.5 → ~27px tall */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="h-7 w-10 bg-surface-sunken animate-pulse" />
            <div className="h-7 w-10 bg-surface-sunken animate-pulse" />
            <div className="h-7 w-14 bg-surface-sunken animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

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

  // Linked state
  if (currentLink) {
    const linkedTypeDef = getCredentialTypeDef(currentLink.credentialType);
    const isOAuth = linkedTypeDef?.authMethod === "oauth2";
    return (
      <div className="bg-surface-sunken/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link2 className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={1.5} />
            <span className="text-sm font-medium text-ink truncate">
              {currentLink.credentialName}
            </span>
            <StatusBadge status={currentLink.status} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TestCredentialButton credentialId={currentLink.credentialId as Id<"credentials">} />
            {isOAuth && linkedTypeDef && (
              <InlineReconnectButton
                typeDef={linkedTypeDef}
                credentialId={currentLink.credentialId as Id<"credentials">}
              />
            )}
            {linkedTypeDef && !editingLinked && (
              <button
                onClick={() => setEditingLinked(true)}
                className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.1em] font-semibold text-ink-muted hover:text-ink px-2 py-1.5 transition-colors"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.5} />
                {isOAuth ? "Rename" : "Edit"}
              </button>
            )}
            <button
              onClick={handleUnlink}
              className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.1em] font-semibold text-ink-faint hover:text-danger px-2 py-1.5 transition-colors"
            >
              <Unlink className="h-3 w-3" strokeWidth={1.5} />
              Unlink
            </button>
          </div>
        </div>
        {editingLinked && linkedTypeDef && (
          <div className="mt-4 pt-4 border-t border-rule">
            <InlineEditForm
              credentialId={currentLink.credentialId as Id<"credentials">}
              currentName={currentLink.credentialName}
              typeDef={linkedTypeDef}
              onDone={() => setEditingLinked(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Existing credentials */}
      {compatibleCredentials && compatibleCredentials.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Link existing</p>
          <ul className="divide-y divide-rule border-y border-rule">
            {compatibleCredentials.map((cred) => (
              <li key={cred._id}>
                <button
                  onClick={() => handleLink(cred._id)}
                  className="w-full flex items-center justify-between px-1 py-3 text-sm hover:bg-surface-sunken/60 transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Link2 className="h-3.5 w-3.5 text-ink-faint shrink-0" strokeWidth={1.5} />
                    <span className="text-ink truncate">{cred.name}</span>
                    <StatusBadge status={cred.status} />
                  </span>
                  <span className="text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint">
                    Link &rarr;
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create new */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Create new credential
        </button>
      ) : (
        <div className="border-y border-rule py-5 space-y-5">
          {compatibleTypes.length > 1 && (
            <Field label="Credential type">
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={inputClass + " appearance-none pr-6"}
                >
                  {compatibleTypes.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint pointer-events-none"
                  strokeWidth={1.5}
                />
              </div>
            </Field>
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

  const [name, setName] = useState(`My ${typeDef.label}`);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of typeDef.fields) init[f.key] = "";
    return init;
  });
  const [saving, setSaving] = useState(false);

  if (typeDef.authMethod === "oauth2") {
    return <OAuthConnectButton typeDef={typeDef} onCancel={onCancel} />;
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
    <div className="space-y-5">
      <Field label="Credential name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>

      {typeDef.fields.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          hint={field.required ? undefined : "Optional"}
        >
          {field.type === "select" ? (
            <div className="relative">
              <select
                value={fields[field.key]}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className={inputClass + " appearance-none pr-6"}
              >
                <option value="">Select\u2026</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint pointer-events-none"
                strokeWidth={1.5}
              />
            </div>
          ) : (
            <input
              type={field.type === "password" ? "password" : "text"}
              value={fields[field.key]}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              placeholder={field.placeholder}
              className={monoInputClass}
            />
          )}
          {field.helpText && (
            <p className="mt-1.5 text-2xs text-ink-faint leading-snug">
              {field.helpText}
            </p>
          )}
        </Field>
      ))}

      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !requiredFilled || !name.trim()}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-ink text-ink-inverse px-4 py-2 rounded-sm hover:bg-ink-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          {saving ? "Saving\u2026" : "Save & link"}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-ink-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function OAuthConnectButton({
  typeDef,
  onCancel,
  defaultName,
}: {
  typeDef: CredentialTypeDef;
  onCancel: () => void;
  defaultName?: string;
}) {
  const startOAuth = useAction(api.credentialActions.startOAuth);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(defaultName ?? `My ${typeDef.label}`);

  async function handleConnect() {
    if (!typeDef.oauth2) return;
    setLoading(true);
    try {
      const { authUrl } = await startOAuth({
        provider: typeDef.type,
        scopes: typeDef.oauth2.scopes,
        credentialName: name.trim() || undefined,
      });
      window.location.href = authUrl;
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted leading-relaxed">
        {typeDef.description}. Authorize via OAuth to create the credential.
      </p>
      <Field label="Credential name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`My ${typeDef.label}`}
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-4">
        <button
          onClick={handleConnect}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-ink text-ink-inverse px-4 py-2 rounded-sm hover:bg-ink-muted disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          {loading ? "Redirecting\u2026" : `Connect ${typeDef.label}`}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-ink-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

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
    setTimeout(() => setResult(null), 5000);
  }

  return (
    <button
      onClick={handleTest}
      disabled={testing}
      title={result?.error ?? "Test credential"}
      className={`inline-flex items-center gap-1 text-2xs uppercase tracking-[0.1em] font-semibold transition-colors px-2 py-1.5 disabled:opacity-50 ${
        result?.valid
          ? "text-accent"
          : result && !result.valid
            ? "text-danger"
            : "text-ink-muted hover:text-ink"
      }`}
    >
      {testing ? (
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
      ) : result?.valid ? (
        <Check className="h-3 w-3" strokeWidth={2} />
      ) : result && !result.valid ? (
        <X className="h-3 w-3" strokeWidth={2} />
      ) : (
        <Zap className="h-3 w-3" strokeWidth={1.5} />
      )}
      {testing ? "Testing" : result?.valid ? "Valid" : result ? "Failed" : "Test"}
    </button>
  );
}

function InlineReconnectButton({
  typeDef,
  credentialId,
}: {
  typeDef: CredentialTypeDef;
  credentialId: Id<"credentials">;
}) {
  const reconnectOAuth = useAction(api.credentialActions.reconnectOAuth);
  const [loading, setLoading] = useState(false);

  async function handleReconnect() {
    if (!typeDef.oauth2) return;
    setLoading(true);
    try {
      const { authUrl } = await reconnectOAuth({
        provider: typeDef.type,
        scopes: typeDef.oauth2.scopes,
        credentialId,
      });
      window.location.href = authUrl;
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleReconnect}
      disabled={loading}
      title="Re-authorize to refresh tokens"
      className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.1em] font-semibold text-accent hover:text-accent-strong transition-colors px-2 py-1.5 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
      ) : (
        <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
      )}
      Reconnect
    </button>
  );
}

function InlineEditForm({
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

  const isOAuth = typeDef.authMethod === "oauth2";
  const [name, setName] = useState(currentName);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of typeDef.fields) init[f.key] = "";
    return init;
  });
  const [loading, setLoading] = useState(!isOAuth);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOAuth) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getDecrypted({ credentialId });
        if (cancelled) return;
        const init: Record<string, string> = {};
        for (const f of typeDef.fields)
          init[f.key] = (data?.[f.key] ?? "") as string;
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

  const requiredFilled =
    isOAuth ||
    typeDef.fields
      .filter((f) => f.required)
      .every((f) => fields[f.key]?.trim());

  async function handleSave() {
    if (!requiredFilled || !name.trim()) return;
    setSaving(true);
    try {
      await updateCredential({
        credentialId,
        name: name.trim() !== currentName ? name.trim() : undefined,
        ...(isOAuth ? {} : { data: fields }),
      });
      onDone();
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  if (loading) {
    // Each field: eyebrow label (text-[10px] ~13px) + mb-1.5 + input (text-sm h-5 + pb-2 border-b)
    const FieldSkeleton = ({ labelW }: { labelW: string }) => (
      <div>
        <div className={`h-[13px] ${labelW} bg-surface-sunken animate-pulse mb-1.5`} />
        <div className="border-b border-rule-strong pb-2">
          <div className="h-5 bg-surface-sunken animate-pulse" />
        </div>
      </div>
    );
    return (
      <div className="space-y-5">
        {/* Name field */}
        <FieldSkeleton labelW="w-8" />
        {/* One field per typeDef.fields */}
        {typeDef.fields.map((f, i) => (
          <FieldSkeleton key={i} labelW={i % 2 === 0 ? "w-20" : "w-16"} />
        ))}
        {/* Buttons: Save (text-sm py-2 → h-9) + Cancel (text-sm inline → h-5) */}
        <div className="flex items-center gap-4 pt-1">
          <div className="h-9 w-24 bg-surface-sunken animate-pulse" />
          <div className="h-5 w-12 bg-surface-sunken animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-danger">{error}</p>
        <button
          onClick={onDone}
          className="text-sm text-ink-muted hover:text-ink transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>
      {!isOAuth &&
        typeDef.fields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            hint={field.required ? undefined : "Optional"}
          >
            <input
              type={field.type === "password" ? "password" : "text"}
              value={fields[field.key]}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              placeholder={field.placeholder}
              className={monoInputClass}
            />
            {field.helpText && (
              <p className="mt-1.5 text-2xs text-ink-faint leading-snug">
                {field.helpText}
              </p>
            )}
          </Field>
        ))}
      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !requiredFilled || !name.trim()}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-ink text-ink-inverse px-4 py-2 rounded-sm hover:bg-ink-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          {saving ? "Saving\u2026" : "Save"}
        </button>
        <button
          onClick={onDone}
          className="text-sm text-ink-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
