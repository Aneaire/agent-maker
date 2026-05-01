import type { GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";

/** AI provider credential types in priority order. */
const AI_PROVIDER_TYPES = ["anthropic", "google_ai", "openai"] as const;

/** Hardcoded defaults — used when no platformConfig document exists yet. */
const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  google_ai: "gemini-3-flash-preview",
  openai: "gpt-4o-mini",
};

const DEFAULT_FALLBACK = "gemini-3-flash-preview";

/**
 * Picks the best default model for a user based on which AI provider
 * credentials they have configured. Reads admin-configured defaults from
 * the platformConfig table if available, otherwise uses hardcoded defaults.
 * Falls back to gemini-3-flash-preview (platform-provided Gemini key).
 */
export async function getDefaultModelForUser(
  ctx: GenericQueryCtx<DataModel>,
  userId: Id<"users">
): Promise<string> {
  // Read admin-configured defaults (single-document table)
  const config = await ctx.db.query("platformConfig").first();
  const providerDefaults = config?.providerDefaults as Record<string, string> | undefined;
  const fallbackModel = (config?.fallbackModel as string) ?? DEFAULT_FALLBACK;

  const creds = await ctx.db
    .query("credentials")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  for (const provider of AI_PROVIDER_TYPES) {
    if (creds.some((c) => c.type === provider)) {
      return (
        providerDefaults?.[provider] ??
        DEFAULT_PROVIDER_MODELS[provider] ??
        fallbackModel
      );
    }
  }

  return fallbackModel;
}
