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
          <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" fill="currentColor" />
          <path d="m2 6 10 7L22 6" stroke="var(--color-surface)" strokeWidth="1.5" strokeLinejoin="round" />
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
      return <Image className={className} strokeWidth={1.5} />;
    case "anthropic":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm1.21 5.175l-2.33 6.003h4.66l-2.33-6.003z" />
        </svg>
      );
    case "google_ai":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 11.366v3.38h5.32c-.235 1.395-.945 2.575-2.01 3.37l3.25 2.52c1.895-1.745 2.99-4.315 2.99-7.365 0-.71-.065-1.39-.185-2.045H12v.14zm-7.134 2.15a7.003 7.003 0 010-3.032L1.59 8.01A11.965 11.965 0 000 12c0 1.935.465 3.765 1.29 5.385l3.576-2.87zM12 4.83c1.77 0 3.355.61 4.605 1.8l3.455-3.455C17.955 1.185 15.235 0 12 0 7.31 0 3.255 2.69 1.59 6.615l3.575 2.87C6.145 6.665 8.835 4.83 12 4.83zM12 19.17c-3.165 0-5.855-1.835-6.835-4.655l-3.575 2.87C3.255 21.31 7.31 24 12 24c3.06 0 5.64-.995 7.55-2.73l-3.25-2.52c-.93.6-2.1.975-3.435.975l-.865-.555z" />
        </svg>
      );
    case "openai":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.1 14.11A4.5 4.5 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.724 2.727a4.5 4.5 0 0 1-.679 8.122V12.48a.79.79 0 0 0-.398-.729zm2.0-3.293l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 8.959V6.63a.07.07 0 0 1 .028-.061L14.17 3.86a4.492 4.492 0 0 1 6.67 4.653zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.81a4.492 4.492 0 0 1 7.375-3.453l-.142.08L8.704 6.196a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
      );
    default:
      return <KeyRound className={className} strokeWidth={1.5} />;
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
        className="w-full flex items-center gap-3 bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-left hover:border-ink-muted focus:border-accent focus:outline-none transition-colors"
      >
        <ServiceIcon type={value} className="h-5 w-5 shrink-0 text-ink" />
        <span className="flex-1 truncate">
          <span className="text-ink">{selected?.label}</span>
          <span className="text-ink-faint"> &mdash; {selected?.description}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-ink-faint shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-raised border border-rule rounded-sm shadow-xl shadow-surface-inverse/10 overflow-hidden rise max-h-72 overflow-y-auto">
          {Object.values(CREDENTIAL_TYPE_REGISTRY).map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => {
                onChange(t.type);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                t.type === value ? "bg-surface-sunken" : "hover:bg-surface-sunken/60"
              }`}
            >
              <ServiceIcon type={t.type} className="h-5 w-5 shrink-0 text-ink" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink truncate">{t.label}</div>
                <div className="text-2xs text-ink-faint truncate">{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Credentials \u2014 HiGantic" }];
}

export default function CredentialsPage() {
  const credentials = useQuery(api.credentials.list);
  const removeCredential = useMutation(api.credentials.remove);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("resend");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth === "success") {
      setOauthMessage("Google account connected successfully.");
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
      <div className="max-w-3xl mx-auto">
        {/* ── Header ────────────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-8 mb-10">
          <div>
            <p className="eyebrow">Access</p>
            <h1 className="mt-3 font-display text-4xl leading-[1] tracking-tight text-ink">
              Credentials
            </h1>
            <p className="mt-4 text-sm text-ink-muted max-w-lg leading-relaxed">
              API keys and OAuth connections live here. Link them to agents
              from each agent&rsquo;s settings &mdash; one credential can power
              many agents.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1.5 bg-ink text-ink-inverse text-sm font-medium px-4 py-2 rounded-sm hover:bg-ink-muted transition-colors shrink-0 mt-2"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            New credential
          </button>
        </header>

        {oauthMessage && (
          <Notice
            tone={oauthMessage.includes("error") ? "danger" : "accent"}
            onDismiss={() => setOauthMessage(null)}
          >
            {oauthMessage}
          </Notice>
        )}

        <MigrateLegacySection />

        {/* ── Create new credential ─────────────────────────────────── */}
        {showCreate && (
          <section className="border-y border-rule py-6 mb-6 rise">
            <p className="eyebrow mb-4">New credential</p>
            <div className="space-y-5">
              <Field label="Type">
                <CredentialTypeSelector value={selectedType} onChange={setSelectedType} />
              </Field>
              <StandaloneCredentialForm
                typeDef={CREDENTIAL_TYPE_REGISTRY[selectedType]!}
                onCreated={() => setShowCreate(false)}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </section>
        )}

        {/* ── List existing credentials ─────────────────────────────── */}
        {credentials === undefined ? (
          <div className="flex items-center gap-2 text-sm text-ink-faint py-10">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            Loading credentials\u2026
          </div>
        ) : credentials.length === 0 && !showCreate ? (
          <div className="border-y border-rule py-16">
            <div className="max-w-md">
              <p className="eyebrow">Empty</p>
              <h2 className="mt-2 font-display text-2xl leading-tight text-ink">
                No credentials yet.
              </h2>
              <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                Create your first credential to start connecting agents to
                external services.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-5 inline-flex items-center gap-1.5 bg-ink text-ink-inverse text-sm font-medium px-4 py-2 rounded-sm hover:bg-ink-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Create credential
              </button>
            </div>
          </div>
        ) : (
          <ol className="divide-y divide-rule border-y border-rule">
            {credentials.map((cred, i) => {
              const isEditing = editingId === cred._id;
              const typeDef = CREDENTIAL_TYPE_REGISTRY[cred.type];
              return (
                <li key={cred._id} className="group">
                  <div className="grid grid-cols-[3ch_auto_1fr_auto] gap-4 items-baseline py-5">
                    <span className="font-mono text-2xs text-ink-faint tabular-nums self-center">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <ServiceIcon
                      type={cred.type}
                      className="h-5 w-5 shrink-0 text-ink self-center"
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <h3 className="font-display text-lg leading-tight text-ink truncate">
                          {cred.name}
                        </h3>
                        <StatusBadge status={cred.status} />
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {typeDef?.label ?? cred.type}
                        {cred.lastTestedAt && (
                          <>
                            <span className="text-ink-faint"> &middot; tested </span>
                            <span className="font-mono text-2xs text-ink-faint tabular-nums">
                              {new Date(cred.lastTestedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 self-center">
                      {!isEditing && typeDef && typeDef.authMethod === "oauth2" && (
                        <ReconnectButton
                          typeDef={typeDef}
                          credentialId={cred._id as Id<"credentials">}
                        />
                      )}
                      {!isEditing && (
                        <TestButton credentialId={cred._id as Id<"credentials">} />
                      )}
                      {!isEditing && typeDef && (
                        <button
                          onClick={() => setEditingId(cred._id)}
                          title="Rename"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-ink-faint hover:text-ink transition-all"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(cred._id)}
                        title="Delete"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-ink-faint hover:text-danger transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {isEditing && typeDef && (
                    <div className="pb-6 pl-[calc(3ch+1rem+20px+1rem)] pr-4 max-w-2xl">
                      <EditCredentialForm
                        credentialId={cred._id as Id<"credentials">}
                        currentName={cred.name}
                        typeDef={typeDef}
                        onDone={() => setEditingId(null)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Notice (replaces tinted banners) ─────────────────────────────────

function Notice({
  tone,
  onDismiss,
  children,
}: {
  tone: "accent" | "danger";
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const bar =
    tone === "danger" ? "bg-danger" : "bg-accent";
  return (
    <div className="mb-6 grid grid-cols-[3px_1fr_auto] gap-3 bg-surface-sunken/60 px-4 py-3 text-sm text-ink">
      <div className={`${bar} rounded-full`} />
      <span className="leading-relaxed">{children}</span>
      <button
        onClick={onDismiss}
        className="text-xs text-ink-faint hover:text-ink transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}

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
      <Notice tone="accent" onDismiss={() => setResult(null)}>
        Migration complete &mdash; {result.migrated} credential(s) created,{" "}
        {result.linked} link(s) established, {result.skipped} skipped.
      </Notice>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-surface-sunken/40 px-4 py-3 mb-6 text-sm">
      <div>
        <p className="text-ink font-medium">Migrate legacy configs</p>
        <p className="text-ink-muted mt-0.5">
          Import existing agent tool configurations into the credential system.
        </p>
      </div>
      <button
        onClick={handleMigrate}
        disabled={migrating}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink hover:text-ink-muted disabled:opacity-50 transition-colors px-3 py-1.5 shrink-0"
      >
        {migrating ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
        ) : null}
        {migrating ? "Migrating\u2026" : "Migrate"}
      </button>
    </div>
  );
}

// ── Field / Input shared primitives ──────────────────────────────────

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

const inputClass =
  "w-full bg-transparent border-0 border-b border-rule-strong pb-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors";
const monoInputClass = inputClass + " font-mono";

// ── Standalone credential form (creating) ────────────────────────────

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

  useEffect(() => {
    setName(`My ${typeDef.label}`);
    const init: Record<string, string> = {};
    for (const f of typeDef.fields) init[f.key] = "";
    setFields(init);
  }, [typeDef.type]);

  if (typeDef.authMethod === "oauth2") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-ink-muted leading-relaxed">{typeDef.description}</p>
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`My ${typeDef.label}`}
            className={inputClass}
          />
        </Field>
        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={async () => {
              setSaving(true);
              try {
                const { authUrl } = await startOAuth({
                  provider: typeDef.type,
                  scopes: typeDef.oauth2!.scopes,
                  credentialName: name.trim() || undefined,
                });
                window.location.href = authUrl;
              } catch (err: any) {
                alert(err.message);
                setSaving(false);
              }
            }}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-ink text-ink-inverse px-4 py-2 rounded-sm hover:bg-ink-muted disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            {saving ? "Redirecting\u2026" : `Connect ${typeDef.label}`}
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
    <div className="space-y-5">
      <Field label="Name">
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
          {saving ? "Saving\u2026" : "Create"}
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
  const isOAuth = typeDef.authMethod === "oauth2";
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
    return (
      <div className="flex items-center gap-2 text-sm text-ink-faint py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
        Loading current values\u2026
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
          {saving ? "Saving\u2026" : "Save changes"}
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

function ReconnectButton({
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
        <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
      )}
      Reconnect
    </button>
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

function StatusBadge({ status }: { status: string }) {
  const label = status === "untested" ? "Untested" : status.charAt(0).toUpperCase() + status.slice(1);
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
