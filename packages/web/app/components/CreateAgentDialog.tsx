import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useNavigate } from "react-router";
import { X } from "lucide-react";

export function CreateAgentDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createAgent = useMutation(api.agents.create);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const agentId = await createAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
      });
      navigate(`/agents/${agentId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create agent");
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-surface-raised border border-rule rounded-md rise">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <p className="eyebrow">New</p>
            <h2 className="mt-1 font-display text-2xl leading-tight text-ink">
              Create an agent
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-ink-faint hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pricing copilot"
              className="input"
              autoFocus
            />
          </Field>

          <Field label="Description" hint="Optional · one line for the index">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Answers pricing questions from support threads"
              className="input"
            />
          </Field>

          <Field label="System prompt" hint="Optional · you can edit this later">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a careful, patient assistant\u2026"
              rows={4}
              className="input resize-none"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-rule">
          <button
            onClick={onClose}
            className="text-sm text-ink-muted hover:text-ink transition-colors px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="text-sm font-medium bg-ink text-ink-inverse px-4 py-2 rounded-sm hover:bg-ink-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? "Creating\u2026" : "Create agent"}
          </button>
        </div>
      </div>
      <style>{`
        .input {
          width: 100%;
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--color-rule-strong);
          padding: 0.5rem 0;
          font-size: 0.875rem;
          color: var(--color-ink);
          transition: border-color 150ms var(--ease-quart);
        }
        .input::placeholder { color: var(--color-ink-faint); }
        .input:focus {
          outline: none;
          border-bottom-color: var(--color-accent);
        }
      `}</style>
    </div>
  );
}

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
      <div className="flex items-baseline justify-between mb-0.5">
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
