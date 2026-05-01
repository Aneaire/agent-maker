import type { LanguageModel } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// The AI SDK Google provider expects GOOGLE_GENERATIVE_AI_API_KEY but the
// project uses GEMINI_API_KEY — pass it explicitly so both env var names work.
const defaultGoogle = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const openrouter = process.env.OPENROUTER_API_KEY
  ? createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
  : null;

const DEFAULT_MODEL = "gemini-3-flash-preview";

/** Credential type key (matches CREDENTIAL_TYPE_REGISTRY) for each provider
 * family. Returned so callers can fetch the matching stored credential. */
export type AiProviderType =
  | "anthropic"
  | "google_ai"
  | "openai"
  | "openrouter";

/** Maps a model id to its provider credential type, or null if unrecognized. */
export function providerTypeForModel(
  modelId: string | undefined | null
): AiProviderType | null {
  const id = (modelId ?? "").trim();
  if (!id) return "anthropic"; // default model is claude-*
  if (id.startsWith("claude-")) return "anthropic";
  if (id.startsWith("gemini-")) return "google_ai";
  if (
    id.startsWith("gpt-") ||
    id.startsWith("o1") ||
    id.startsWith("o3") ||
    id.startsWith("o4")
  ) {
    return "openai";
  }
  return "openrouter";
}

export interface GetLanguageModelOpts {
  /** Optional user-supplied API key. When set, a per-call provider instance is
   * created with this key (BYOK). Falls back to env-var-bound singletons when
   * omitted. */
  apiKey?: string | null;
}

export function getLanguageModel(
  modelId: string | undefined | null,
  opts: GetLanguageModelOpts = {}
): LanguageModel {
  const id = (modelId ?? "").trim() || DEFAULT_MODEL;
  const apiKey = opts.apiKey?.trim() || undefined;

  if (id.startsWith("claude-")) {
    if (apiKey) return createAnthropic({ apiKey })(id);
    return anthropic(id);
  }
  if (id.startsWith("gemini-")) {
    if (apiKey) return createGoogleGenerativeAI({ apiKey })(id);
    return defaultGoogle(id);
  }
  if (
    id.startsWith("gpt-") ||
    id.startsWith("o1") ||
    id.startsWith("o3") ||
    id.startsWith("o4")
  ) {
    if (apiKey) return createOpenAI({ apiKey })(id);
    return openai(id);
  }

  // Catch-all: OpenRouter. Supports provider-prefixed IDs like
  // "mistralai/mistral-large", "deepseek/deepseek-chat", "xai/grok-4", etc.
  if (apiKey) return createOpenRouter({ apiKey })(id);
  if (!openrouter) {
    throw new Error(
      `Unrecognized model "${id}". Set OPENROUTER_API_KEY to use providers beyond Anthropic/Google/OpenAI, or switch to a supported model prefix (claude-*, gemini-*, gpt-*, o1*, o3*, o4*).`
    );
  }
  return openrouter(id);
}

/** Throws a user-friendly error when the runtime has neither a BYOK key nor an
 * env-var fallback for the selected model. Call this before streaming so the
 * failure surfaces as a readable message rather than a provider-level 401. */
export function assertProviderCredentialAvailable(
  modelId: string | undefined | null,
  byokKey: string | null | undefined
): void {
  if (byokKey) return;
  const provider = providerTypeForModel(modelId);
  const envOk = (() => {
    switch (provider) {
      case "anthropic":
        return !!process.env.ANTHROPIC_API_KEY;
      case "google_ai":
        return !!(
          process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
        );
      case "openai":
        return !!process.env.OPENAI_API_KEY;
      case "openrouter":
        return !!process.env.OPENROUTER_API_KEY;
      default:
        return false;
    }
  })();
  if (envOk) return;

  const settingsHint: Record<AiProviderType, string> = {
    anthropic: "Anthropic (Claude)",
    google_ai: "Google AI (Gemini)",
    openai: "OpenAI (GPT / o-series)",
    openrouter: "OpenRouter",
  };
  const friendly = provider ? settingsHint[provider] : "this model provider";
  throw new Error(
    `No API key available for ${friendly}. Add a credential in Settings → Credentials, or configure the corresponding server env var.`
  );
}

export function getProviderOptions(
  modelId: string | undefined | null
): Record<string, any> | undefined {
  const id = (modelId ?? "").trim();

  if (id.startsWith("claude-")) {
    // Reserved hook for Anthropic-specific features (prompt caching metadata,
    // extended thinking). Caching is usually configured per-message via
    // `providerOptions.anthropic.cacheControl`, not at the call level.
    return undefined;
  }
  return undefined;
}
