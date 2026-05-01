import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminAuth";

const DEFAULTS = {
  providerDefaults: {
    anthropic: "claude-sonnet-4-6",
    google_ai: "gemini-3-flash-preview",
    openai: "gpt-4o-mini",
  },
  fallbackModel: "gemini-3-flash-preview",
};

/** Admin-gated: returns current platform config or defaults.
 *  Returns null if the user is not authenticated or not an admin. */
export const get = query({
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
    } catch (e: any) {
      const identity = await ctx.auth.getUserIdentity();
      console.log("[platformConfig.get] admin check failed:", e.message, "identity email:", identity?.email, "identity name:", identity?.name, "tokenIdentifier:", identity?.tokenIdentifier);
      return null;
    }
    const config = await ctx.db.query("platformConfig").first();
    if (!config) return { ...DEFAULTS, _id: null as any, updatedAt: null as any, updatedBy: null as any };
    return config;
  },
});

/** Public: returns just the default models (no admin info). Used by modelDefaults.ts at query time. */
export const getDefaults = query({
  handler: async (ctx) => {
    const config = await ctx.db.query("platformConfig").first();
    if (!config) return DEFAULTS;
    return {
      providerDefaults: config.providerDefaults,
      fallbackModel: config.fallbackModel,
    };
  },
});

/** Admin-gated: upsert platform config. */
export const update = mutation({
  args: {
    providerDefaults: v.object({
      anthropic: v.string(),
      google_ai: v.string(),
      openai: v.string(),
    }),
    fallbackModel: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);

    const existing = await ctx.db.query("platformConfig").first();
    const data = {
      providerDefaults: args.providerDefaults,
      fallbackModel: args.fallbackModel,
      updatedAt: Date.now(),
      updatedBy: identity.email ?? "unknown",
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("platformConfig", data);
    }
  },
});
