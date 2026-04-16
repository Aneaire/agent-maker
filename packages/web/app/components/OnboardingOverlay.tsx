import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { ONBOARDING_CATEGORIES, type Template } from "~/lib/templates";

type CategoryId = "personal" | "work" | "creative";

export function OnboardingOverlay({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate();
  const createFromTemplate = useMutation(api.agents.createFromTemplate);
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  async function handleSkip() {
    await completeOnboarding();
    onComplete();
  }

  function handleCategorySelect(categoryId: CategoryId) {
    setSelectedCategory(categoryId);
    setStep(2);
  }

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
      await completeOnboarding();
      navigate(`/agents/${agentId}`);
    } catch (err: any) {
      console.error("Failed to create agent:", err);
      setCreating(null);
    }
  }

  const selectedCategoryData = ONBOARDING_CATEGORIES.find(
    (c) => c.id === selectedCategory
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/40 backdrop-blur-[2px] p-6">
      <div className="relative w-full max-w-2xl">
        <button
          onClick={handleSkip}
          className="absolute -top-10 right-0 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
        >
          Skip for now
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>

        <div className="bg-surface-raised border border-rule rounded-md rise">
          <header className="px-10 pt-10 pb-6 border-b border-rule">
            <p className="eyebrow">{step === 1 ? "Step 1 of 2" : "Step 2 of 2"}</p>
            <h2 className="mt-3 font-display text-3xl leading-[1.05] text-ink">
              {step === 1
                ? "What will your agent do?"
                : `${selectedCategoryData?.label.toLowerCase()} templates`}
            </h2>
            <p className="mt-3 text-sm text-ink-muted max-w-lg leading-relaxed">
              {step === 1
                ? "Pick a direction. We'll use it to show a short list of starting points — you can customise everything afterwards."
                : selectedCategoryData?.description}
            </p>
          </header>

          <div className="px-10 py-8">
            {step === 1 ? (
              <ul className="divide-y divide-rule -mx-2">
                {ONBOARDING_CATEGORIES.map((category) => (
                  <li key={category.id}>
                    <button
                      onClick={() => handleCategorySelect(category.id)}
                      className="group w-full text-left px-2 py-4 grid grid-cols-[auto_1fr_auto] gap-4 items-baseline hover:bg-surface-sunken transition-colors"
                    >
                      <span className="font-mono text-2xs text-ink-faint tabular-nums w-6">
                        {String(ONBOARDING_CATEGORIES.indexOf(category) + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="font-display text-xl leading-tight text-ink">
                          {category.label}
                        </h3>
                        <p className="mt-1 text-sm text-ink-muted max-w-md leading-relaxed">
                          {category.description}
                        </p>
                      </div>
                      <span className="text-2xs text-ink-faint group-hover:text-accent transition-colors">
                        {category.templates.length}&nbsp;templates &rarr;
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.12em] font-semibold text-ink-faint hover:text-ink-muted mb-5 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
                  Back
                </button>
                <ul className="divide-y divide-rule -mx-2">
                  {selectedCategoryData?.templates.map((template) => {
                    const isCreating = creating === template.id;
                    return (
                      <li key={template.id}>
                        <button
                          onClick={() => handleTemplateSelect(template)}
                          disabled={creating !== null}
                          className="group w-full text-left px-2 py-4 grid grid-cols-[1fr_auto] gap-4 items-start hover:bg-surface-sunken transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                          <div className="min-w-0">
                            <h3 className="font-display text-lg leading-tight text-ink">
                              {template.name}
                            </h3>
                            <p className="mt-1 text-sm text-ink-muted leading-relaxed">
                              {template.description}
                            </p>
                            {template.starterPages.length > 0 && (
                              <p className="mt-2 text-2xs text-ink-faint font-mono">
                                {template.starterPages.map((p) => p.label).join(" · ")}
                              </p>
                            )}
                          </div>
                          <span className="text-2xs text-ink-faint group-hover:text-accent transition-colors pt-1 shrink-0">
                            {isCreating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                            ) : (
                              <>Start &rarr;</>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
