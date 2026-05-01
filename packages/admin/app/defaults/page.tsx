"use client";

import { useQuery, useMutation } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { CHAT_MODELS } from "@agent-maker/shared/src/models";
import { useState, useEffect } from "react";

const PROVIDER_GROUPS = [
  { key: "anthropic", label: "Anthropic (Claude)", group: "Claude" as const },
  { key: "google_ai", label: "Google AI (Gemini)", group: "Gemini" as const },
  { key: "openai", label: "OpenAI", group: "OpenAI" as const },
];

export default function DefaultsPage() {
  const { signOut } = useClerk();
  const config = useQuery(api.platformConfig.get);
  const updateConfig = useMutation(api.platformConfig.update);

  const [anthropic, setAnthropic] = useState("");
  const [google_ai, setGoogleAi] = useState("");
  const [openai, setOpenai] = useState("");
  const [fallback, setFallback] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  // Sync form state from query
  useEffect(() => {
    if (!config) return;
    const defaults = config.providerDefaults;
    setAnthropic(defaults.anthropic);
    setGoogleAi(defaults.google_ai);
    setOpenai(defaults.openai);
    setFallback(config.fallbackModel);
  }, [config]);

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    try {
      await updateConfig({
        providerDefaults: {
          anthropic,
          google_ai,
          openai,
        },
        fallbackModel: fallback,
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  if (config === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  // Admin check failed
  if (config === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-300 mb-2">Access Denied</h1>
          <p className="text-zinc-500 text-sm mb-6">You do not have admin access.</p>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="text-sm bg-zinc-800 text-zinc-300 px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
          >
            Sign out &amp; switch account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-800/60 px-8 py-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-1">
            Admin
          </p>
          <h1 className="text-lg font-semibold text-zinc-100">
            Platform Model Defaults
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure the default model for each AI provider. These are used when
            users create new agents.
          </p>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-2xl mx-auto px-8 py-8 space-y-8">
        {/* Provider defaults */}
        {PROVIDER_GROUPS.map((provider) => {
          const models = CHAT_MODELS.filter((m) => m.group === provider.group);
          const value =
            provider.key === "anthropic"
              ? anthropic
              : provider.key === "google_ai"
                ? google_ai
                : openai;
          const setter =
            provider.key === "anthropic"
              ? setAnthropic
              : provider.key === "google_ai"
                ? setGoogleAi
                : setOpenai;

          return (
            <div
              key={provider.key}
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5"
            >
              <label className="block text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-3">
                {provider.label}
              </label>
              <select
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none transition-colors"
              >
                {models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} — {m.description}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-600 mt-2">
                Default model when a user has <strong>{provider.label}</strong> credentials
              </p>
            </div>
          );
        })}

        {/* Fallback model */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <label className="block text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-3">
            Fallback Model
          </label>
          <select
            value={fallback}
            onChange={(e) => setFallback(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none transition-colors"
          >
            {CHAT_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label} — {m.description}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-600 mt-2">
            Used when a user has no AI provider credentials configured
          </p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-zinc-100 text-zinc-900 px-5 py-2.5 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all"
          >
            {saving ? "Saving..." : "Save Defaults"}
          </button>
          {status === "saved" && (
            <span className="text-sm text-emerald-400">Saved</span>
          )}
          {status === "error" && (
            <span className="text-sm text-red-400">
              Failed to save. Check that you have admin access.
            </span>
          )}
        </div>

        {/* Last updated */}
        {config.updatedAt && (
          <p className="text-xs text-zinc-600">
            Last updated by {config.updatedBy} on{" "}
            {new Date(config.updatedAt).toLocaleString()}
          </p>
        )}
      </main>
    </div>
  );
}
