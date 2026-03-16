import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServerAuth } from "./serverAuth";

// ── QUERIES ──────────────────────────────────────────────────────────

export const getAgentConfig = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;
    return {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      enabledToolSets: agent.enabledToolSets,
      iconUrl: agent.iconUrl,
      status: agent.status,
    };
  },
});

export const getUserPlan = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;
    const user = await ctx.db.get(agent.userId);
    if (!user) return null;
    return {
      plan: user.plan,
      maxAgents: user.maxAgents,
    };
  },
});

// ── MUTATIONS ────────────────────────────────────────────────────────

export const setAgentIcon = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("File not found in storage");

    await ctx.db.patch(args.agentId, { iconUrl: url });

    // Update session partialConfig
    const sessions = await ctx.db
      .query("creatorSessions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const session = sessions.find((s) => s.status === "active");
    if (session) {
      const config = (session.partialConfig as Record<string, unknown>) ?? {};
      await ctx.db.patch(session._id, {
        partialConfig: { ...config, iconUrl: url },
      });
    }

    return { success: true, iconUrl: url };
  },
});

export const updateAgentConfig = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    model: v.optional(v.string()),
    enabledToolSets: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.status !== "draft") {
      throw new Error("Draft agent not found");
    }

    const { serverToken, agentId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    // Update slug if name changes
    if (filtered.name) {
      (filtered as Record<string, unknown>).slug = (filtered.name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    await ctx.db.patch(agentId, filtered);

    // Also update the session's partialConfig
    const sessions = await ctx.db
      .query("creatorSessions")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();
    const session = sessions.find((s) => s.status === "active");
    if (session) {
      const currentConfig = (session.partialConfig as Record<string, unknown>) ?? {};
      await ctx.db.patch(session._id, {
        partialConfig: { ...currentConfig, ...filtered },
      });
    }

    return { success: true };
  },
});

export const finalizeAgent = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.status !== "draft") {
      throw new Error("Draft agent not found");
    }

    // Set agent to active
    await ctx.db.patch(args.agentId, { status: "active" });

    // Complete the creator session
    const sessions = await ctx.db
      .query("creatorSessions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const session = sessions.find((s) => s.status === "active");
    if (session) {
      await ctx.db.patch(session._id, { status: "completed" });
    }

    return { success: true, agentId: args.agentId };
  },
});
