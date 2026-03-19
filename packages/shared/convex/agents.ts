import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser, getOrCreateAuthUser, requireAuthUser } from "./auth";

export const list = query({
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const get = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return null;
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return null;
    return agent;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAuthUser(ctx);

    // Check plan limits
    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (existingAgents.length >= user.maxAgents) {
      throw new Error(
        `Agent limit reached (${user.maxAgents}). Upgrade your plan to create more agents.`
      );
    }

    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return await ctx.db.insert("agents", {
      userId: user._id,
      name: args.name,
      slug,
      description: args.description,
      systemPrompt:
        args.systemPrompt ?? `You are ${args.name}, a helpful AI assistant.`,
      model: "claude-sonnet-4-6",
      enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools"],
      status: "active",
    });
  },
});

export const createFromTemplate = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    systemPrompt: v.string(),
    model: v.string(),
    enabledToolSets: v.array(v.string()),
    starterPages: v.optional(
      v.array(v.object({ label: v.string(), type: v.string() }))
    ),
    starterEndpoints: v.optional(
      v.array(
        v.object({
          tabLabel: v.string(),
          name: v.string(),
          method: v.string(),
          description: v.optional(v.string()),
          promptTemplate: v.string(),
          responseFormat: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateAuthUser(ctx);

    // Check plan limits
    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (existingAgents.length >= user.maxAgents) {
      throw new Error(
        `Agent limit reached (${user.maxAgents}). Upgrade your plan to create more agents.`
      );
    }

    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const agentId = await ctx.db.insert("agents", {
      userId: user._id,
      name: args.name,
      slug,
      description: args.description,
      systemPrompt: args.systemPrompt,
      model: args.model,
      enabledToolSets: args.enabledToolSets,
      status: "active",
    });

    // Create starter pages
    const tabMap: Record<string, any> = {};
    if (args.starterPages) {
      // Check plan for page types
      const plan = (user.plan ?? "free") as "free" | "pro" | "enterprise";
      const allowedFree = ["tasks", "notes", "markdown", "data_table"];
      const allowedPro = [...allowedFree, "spreadsheet", "postgres", "api"];
      const allowed = plan === "free" ? allowedFree : allowedPro;

      let sortOrder = 0;
      for (const page of args.starterPages) {
        if (!allowed.includes(page.type)) continue;

        const pageSlug = page.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const tabId = await ctx.db.insert("sidebarTabs", {
          agentId,
          label: page.label.substring(0, 100),
          slug: pageSlug,
          type: page.type as any,
          sortOrder: sortOrder++,
        });

        tabMap[page.label] = tabId;
      }
    }

    // Create starter API endpoints
    if (args.starterEndpoints) {
      for (const ep of args.starterEndpoints) {
        const tabId = tabMap[ep.tabLabel];
        if (!tabId) continue;

        const epSlug = ep.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        await ctx.db.insert("tabApiEndpoints", {
          tabId,
          agentId,
          name: ep.name.substring(0, 100),
          slug: epSlug,
          method: ep.method as any,
          description: ep.description?.substring(0, 500),
          promptTemplate: ep.promptTemplate.substring(0, 5000),
          responseFormat: (ep.responseFormat ?? "json") as any,
          isActive: true,
        });
      }
    }

    return agentId;
  },
});

export const setIcon = mutation({
  args: {
    agentId: v.id("agents"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Agent not found");
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("File not found in storage");

    await ctx.db.patch(args.agentId, { iconUrl: url });

    // Also update creator session partialConfig if agent is a draft
    if (agent.status === "draft") {
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
    }

    return { iconUrl: url };
  },
});

export const update = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    model: v.optional(v.string()),
    imageGenModel: v.optional(v.string()),
    enabledToolSets: v.optional(v.array(v.string())),
    enabledModels: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("draft"))
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Agent not found");
    }

    const { agentId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (filtered.name) {
      (filtered as Record<string, unknown>).slug = (filtered.name as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    await ctx.db.patch(agentId, filtered);
  },
});

export const remove = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Agent not found");
    }

    // Delete related records
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    for (const conv of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conv._id)
        )
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }
      await ctx.db.delete(conv._id);
    }

    const memories = await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const mem of memories) {
      await ctx.db.delete(mem._id);
    }

    const tabs = await ctx.db
      .query("sidebarTabs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const tab of tabs) {
      await ctx.db.delete(tab._id);
    }

    const toolConfigs = await ctx.db
      .query("agentToolConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const tc of toolConfigs) {
      await ctx.db.delete(tc._id);
    }

    const customTools = await ctx.db
      .query("customTools")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const ct of customTools) {
      await ctx.db.delete(ct._id);
    }

    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    // Delete documents and their chunks
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const doc of documents) {
      const chunks = await ctx.db
        .query("documentChunks")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();
      for (const chunk of chunks) {
        await ctx.db.delete(chunk._id);
      }
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }

    // Delete scheduled actions and runs
    const schedules = await ctx.db
      .query("scheduledActions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const schedule of schedules) {
      const runs = await ctx.db
        .query("scheduledActionRuns")
        .withIndex("by_action", (q) => q.eq("actionId", schedule._id))
        .collect();
      for (const run of runs) {
        await ctx.db.delete(run._id);
      }
      await ctx.db.delete(schedule._id);
    }

    // Delete automations
    const automationsToDelete = await ctx.db
      .query("automations")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const automation of automationsToDelete) {
      await ctx.db.delete(automation._id);
    }

    // Delete events
    const events = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    // Delete timers
    const timers = await ctx.db
      .query("agentTimers")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const timer of timers) {
      await ctx.db.delete(timer._id);
    }

    // Delete inter-agent messages (sent)
    const sentMsgs = await ctx.db
      .query("agentMessages")
      .withIndex("by_from_agent", (q) => q.eq("fromAgentId", args.agentId))
      .collect();
    for (const msg of sentMsgs) {
      await ctx.db.delete(msg._id);
    }

    // Delete webhooks
    const webhooksToDelete = await ctx.db
      .query("webhooks")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const wh of webhooksToDelete) {
      await ctx.db.delete(wh._id);
    }

    // Delete email logs
    const emailLogs = await ctx.db
      .query("emailLogs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const log of emailLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete credential links (credentials themselves are user-scoped, not deleted)
    const credLinks = await ctx.db
      .query("agentCredentialLinks")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const link of credLinks) {
      await ctx.db.delete(link._id);
    }

    await ctx.db.delete(args.agentId);
  },
});

// ── Tool Config ───────────────────────────────────────────────────────

export const getToolConfig = query({
  args: {
    agentId: v.id("agents"),
    toolSetName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return null;
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return null;

    const configs = await ctx.db
      .query("agentToolConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const match = configs.find((c) => c.toolSetName === args.toolSetName);
    return match?.config ?? null;
  },
});

export const saveToolConfig = mutation({
  args: {
    agentId: v.id("agents"),
    toolSetName: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Agent not found");
    }

    const existing = await ctx.db
      .query("agentToolConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const match = existing.find((c) => c.toolSetName === args.toolSetName);

    if (match) {
      await ctx.db.patch(match._id, { config: args.config });
    } else {
      await ctx.db.insert("agentToolConfigs", {
        agentId: args.agentId,
        toolSetName: args.toolSetName,
        config: args.config,
      });
    }
  },
});
