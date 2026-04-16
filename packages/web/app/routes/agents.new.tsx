import { useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useNavigate, Link } from "react-router";
import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import {
  PERSONAL_TEMPLATES,
  BUSINESS_TEMPLATES,
  type Template,
} from "~/lib/templates";

export default function NewAgentPage() {
  const navigate = useNavigate();
  const createFromTemplate = useMutation(api.agents.createFromTemplate);
  const [creating, setCreating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "business">("personal");
  const templates = activeTab === "personal" ? PERSONAL_TEMPLATES : BUSINESS_TEMPLATES;

  async function handleTemplateSelect(template: Template) {
    setCreating(template.id);
    try {
      const agentId = await createFromTemplate({
        name: template.name,
        description: template.description,
        systemPrompt: template.systemPrompt,
        model: template.model,
        enabledToolSets: template.enabledToolSets,
        starterPages: template.starterPages,
        starterEndpoints: template.starterEndpoints,
      });
      navigate(`/agents/${agentId}`);
    } catch (err: any) {
      alert(err.message);
      setCreating(null);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="border-b border-rule">
        <div className="max-w-[1100px] mx-auto px-8 h-14 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted transition-colors"
          >
            <ChevronLeft className="h-3 w-3" strokeWidth={1.75} />
            Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-8 py-16">
        {/* ── Title ─────────────────────────────────────────────── */}
        <header className="max-w-xl mb-16">
          <p className="eyebrow">New</p>
          <h1 className="mt-3 font-display text-4xl leading-[1] tracking-tight text-ink">
            Create an agent.
          </h1>
          <p className="mt-4 text-base text-ink-muted leading-relaxed">
            Start from a template, or have an AI assistant build one with you
            from a plain description.
          </p>
        </header>

        {/* ── Build with AI — primary call ──────────────────────── */}
        <Link
          to="/agents/new/creator"
          className="group block border-y border-rule-strong py-8 mb-16 hover:bg-surface-sunken/60 transition-colors"
        >
          <div className="grid grid-cols-[auto_1fr_auto] gap-8 items-baseline">
            <span className="font-mono text-2xs uppercase tracking-[0.12em] text-accent">
              Recommended
            </span>
            <div>
              <h2 className="font-display text-3xl leading-tight text-ink">
                Build with AI.
              </h2>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-lg">
                Chat with an assistant that proposes a name, prompt, tools,
                pages, and endpoints &mdash; you review each step.
              </p>
            </div>
            <span className="text-2xs uppercase tracking-[0.12em] font-semibold text-ink-muted group-hover:text-accent transition-colors">
              Start &rarr;
            </span>
          </div>
        </Link>

        {/* ── Templates ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-6 border-b border-rule pb-3">
            <h2 className="font-display text-2xl leading-tight text-ink">
              Templates
            </h2>
            <div className="flex gap-6 text-2xs uppercase tracking-[0.12em] font-semibold">
              <button
                onClick={() => setActiveTab("personal")}
                className={`transition-colors ${
                  activeTab === "personal"
                    ? "text-ink"
                    : "text-ink-faint hover:text-ink-muted"
                }`}
              >
                Personal
              </button>
              <button
                onClick={() => setActiveTab("business")}
                className={`transition-colors ${
                  activeTab === "business"
                    ? "text-ink"
                    : "text-ink-faint hover:text-ink-muted"
                }`}
              >
                Business
              </button>
            </div>
          </div>

          <ol className="divide-y divide-rule border-b border-rule">
            {templates.map((template, i) => {
              const isCreating = creating === template.id;
              return (
                <li key={template.id}>
                  <button
                    onClick={() => handleTemplateSelect(template)}
                    disabled={creating !== null}
                    className="group w-full text-left grid grid-cols-[3ch_1fr_auto] gap-6 items-baseline py-5 hover:bg-surface-sunken/60 transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    <span className="font-mono text-2xs text-ink-faint tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="font-display text-xl leading-tight text-ink">
                        {template.name}
                      </h3>
                      <p className="mt-1.5 text-sm text-ink-muted leading-relaxed max-w-[65ch]">
                        {template.description}
                      </p>
                      {template.starterPages.length > 0 && (
                        <p className="mt-2 font-mono text-2xs text-ink-faint">
                          {template.starterPages.map((p) => p.label).join(" \u00B7 ")}
                        </p>
                      )}
                    </div>
                    <span className="text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint group-hover:text-accent transition-colors inline-flex items-center gap-1.5">
                      {isCreating ? (
                        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                      ) : null}
                      {isCreating ? "Creating\u2026" : "Start \u2192"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
