import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronUp, Search, Eye, Brain, Check, KeyRound,
} from "lucide-react";
import { CHAT_MODELS, getModelLabel } from "@agent-maker/shared/src/models";
import type { ModelEntry } from "@agent-maker/shared/src/models";

export type { ModelCapability, ModelEntry } from "@agent-maker/shared/src/models";
export { CHAT_MODELS, getModelLabel } from "@agent-maker/shared/src/models";

// ── Provider icons ──────────────────────────────────────────────────────

export function AnthropicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm1.21 5.175l-2.33 6.003h4.66l-2.33-6.003z" />
    </svg>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 11.366v3.38h5.32c-.235 1.395-.945 2.575-2.01 3.37l3.25 2.52c1.895-1.745 2.99-4.315 2.99-7.365 0-.71-.065-1.39-.185-2.045H12v.14zm-7.134 2.15a7.003 7.003 0 010-3.032L1.59 8.01A11.965 11.965 0 000 12c0 1.935.465 3.765 1.29 5.385l3.576-2.87zM12 4.83c1.77 0 3.355.61 4.605 1.8l3.455-3.455C17.955 1.185 15.235 0 12 0 7.31 0 3.255 2.69 1.59 6.615l3.575 2.87C6.145 6.665 8.835 4.83 12 4.83zM12 19.17c-3.165 0-5.855-1.835-6.835-4.655l-3.575 2.87C3.255 21.31 7.31 24 12 24c3.06 0 5.64-.995 7.55-2.73l-3.25-2.52c-.93.6-2.1.975-3.435.975l-.865-.555z" />
    </svg>
  );
}

export function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.1 14.11A4.5 4.5 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.724 2.727a4.5 4.5 0 0 1-.679 8.122V12.48a.79.79 0 0 0-.398-.729zm2.0-3.293l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 8.959V6.63a.07.07 0 0 1 .028-.061L14.17 3.86a4.492 4.492 0 0 1 6.67 4.653zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.81a4.492 4.492 0 0 1 7.375-3.453l-.142.08L8.704 6.196a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  );
}

export function getProviderIcon(group: string) {
  if (group === "Claude") return AnthropicIcon;
  if (group === "Gemini") return GoogleIcon;
  if (group === "OpenAI") return OpenAIIcon;
  return AnthropicIcon;
}

// ── ModelDropdown ───────────────────────────────────────────────────────

export function ModelDropdown({
  model,
  onModelChange,
  disabled,
  enabledModels,
  dropDirection = "up",
  credentialsBannerUrl,
}: {
  model: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  enabledModels?: string[];
  /** Which direction the panel opens. Defaults to "up" (chat input behavior). */
  dropDirection?: "up" | "down";
  /** When set, shows a banner prompting the user to add API keys. */
  credentialsBannerUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "Claude" | "Gemini" | "OpenAI">("all");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setFilter("all");
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) close();
    };
    const id = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", handler);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  const visibleModels = useMemo(() => {
    const base = enabledModels
      ? CHAT_MODELS.filter((m) => enabledModels.includes(m.value))
      : CHAT_MODELS;
    const q = search.toLowerCase();
    return base.filter((m) => {
      if (filter !== "all" && m.group !== filter) return false;
      if (q && !m.label.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, filter, enabledModels]);

  const groups = useMemo(() => {
    const map = new Map<string, ModelEntry[]>();
    for (const m of visibleModels) {
      if (!map.has(m.group)) map.set(m.group, []);
      map.get(m.group)!.push(m);
    }
    return Array.from(map.entries());
  }, [visibleModels]);

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "Claude", label: "Claude" },
    { key: "Gemini", label: "Gemini" },
    { key: "OpenAI", label: "OpenAI" },
  ];

  const panelPositionClass = dropDirection === "down"
    ? "top-full left-0 mt-2"
    : "bottom-full left-0 mb-2";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.1em] font-semibold text-ink-muted hover:text-ink px-2 py-1 disabled:opacity-50 transition-colors"
      >
        {getModelLabel(model)}
        {open
          ? <ChevronUp className="h-2.5 w-2.5 text-ink-faint" strokeWidth={2} />
          : <ChevronDown className="h-2.5 w-2.5 text-ink-faint" strokeWidth={2} />}
      </button>

      {open && (
        <div className={`absolute ${panelPositionClass} w-[370px] h-[420px] flex bg-surface-raised border border-rule shadow-xl shadow-surface-inverse/10 z-50 overflow-hidden rise`}>
          <div className="flex flex-col py-3 px-2 border-r border-rule bg-surface-sunken/40 text-2xs uppercase tracking-[0.1em] font-semibold">
            {filterTabs.map((tab) => {
              const isActive = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`px-2 py-2 text-left transition-colors ${
                    isActive ? "text-accent" : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-rule">
              <div className="flex items-center gap-2 border-b border-rule-strong pb-1">
                <Search className="h-3.5 w-3.5 text-ink-faint shrink-0" strokeWidth={1.5} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models"
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {credentialsBannerUrl && (
                <a
                  href={credentialsBannerUrl}
                  className="flex items-center gap-2 mx-3 mt-1 mb-2 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/15 text-xs text-ink-muted hover:text-ink hover:bg-accent/10 transition-colors"
                >
                  <KeyRound className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={1.5} />
                  <span>
                    <span className="font-medium text-ink">Add an API key</span>{" "}
                    to unlock Claude &amp; OpenAI models
                  </span>
                </a>
              )}
              {groups.map(([group, models]) => (
                <div key={group}>
                  <div className="eyebrow px-4 py-2">{group}</div>
                  {models.map((m) => {
                    const isSelected = m.value === model;
                    const ProviderIcon = getProviderIcon(m.group);
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => { onModelChange(m.value); close(); }}
                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? "bg-surface-sunken" : "hover:bg-surface-sunken/60"
                        }`}
                      >
                        <ProviderIcon
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            isSelected ? "text-accent" : "text-ink-faint"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-ink leading-tight">
                              {m.label}
                            </span>
                            <span className="font-mono text-2xs text-ink-faint">
                              {m.tier}
                            </span>
                          </div>
                          <p className="text-2xs text-ink-muted mt-0.5 leading-snug">
                            {m.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          {m.capabilities.includes("vision") && (
                            <Eye className="h-3 w-3 text-ink-faint" strokeWidth={1.5} />
                          )}
                          {m.capabilities.includes("thinking") && (
                            <Brain className="h-3 w-3 text-ink-faint" strokeWidth={1.5} />
                          )}
                          {isSelected && (
                            <Check className="h-3 w-3 text-accent" strokeWidth={2} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              {visibleModels.length === 0 && (
                <div className="text-center py-6 text-sm text-ink-faint">
                  No models found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
