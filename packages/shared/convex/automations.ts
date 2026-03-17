import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";
import { requireServerAuth } from "./serverAuth";

// ── Automations: Event → Action rules ────────────────────────────────
// Users define: "When [event] happens → do [action1, action2, ...]"

const actionTypeValidator = v.union(
  v.literal("send_email"),
  v.literal("create_task"),
  v.literal("update_task"),
  v.literal("create_note"),
  v.literal("fire_webhook"),
  v.literal("store_memory"),
  v.literal("run_prompt"),
  v.literal("trigger_agent"),
  v.literal("delay"),
);

const actionValidator = v.object({
  type: actionTypeValidator,
  config: v.any(),
});

// ── User-facing ──────────────────────────────────────────────────────

export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];
    return await ctx.db
      .query("automations")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.string(),
    description: v.optional(v.string()),
    trigger: v.object({
      event: v.string(),
      filter: v.optional(v.any()),
    }),
    actions: v.array(actionValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Not authorized");

    const existing = await ctx.db
      .query("automations")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    if (existing.length >= 30) throw new Error("Maximum 30 automations per agent");

    return await ctx.db.insert("automations", {
      agentId: args.agentId,
      name: args.name.substring(0, 200),
      description: args.description?.substring(0, 1000),
      trigger: args.trigger,
      actions: args.actions.slice(0, 10), // max 10 actions per automation
      isActive: true,
      runCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    automationId: v.id("automations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    trigger: v.optional(v.object({
      event: v.string(),
      filter: v.optional(v.any()),
    })),
    actions: v.optional(v.array(actionValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const automation = await ctx.db.get(args.automationId);
    if (!automation) throw new Error("Automation not found");
    const agent = await ctx.db.get(automation.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Not authorized");

    const { automationId, ...updates } = args;
    const filtered: Record<string, any> = {};
    if (updates.name !== undefined) filtered.name = updates.name.substring(0, 200);
    if (updates.description !== undefined) filtered.description = updates.description?.substring(0, 1000);
    if (updates.trigger !== undefined) filtered.trigger = updates.trigger;
    if (updates.actions !== undefined) filtered.actions = updates.actions.slice(0, 10);

    await ctx.db.patch(automationId, filtered);
  },
});

export const toggle = mutation({
  args: { automationId: v.id("automations") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const automation = await ctx.db.get(args.automationId);
    if (!automation) throw new Error("Automation not found");
    const agent = await ctx.db.get(automation.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Not authorized");
    await ctx.db.patch(args.automationId, { isActive: !automation.isActive });
  },
});

export const remove = mutation({
  args: { automationId: v.id("automations") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const automation = await ctx.db.get(args.automationId);
    if (!automation) throw new Error("Automation not found");
    const agent = await ctx.db.get(automation.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Not authorized");
    await ctx.db.delete(args.automationId);
  },
});

// ── Server-facing (agent tools) ──────────────────────────────────────

export const createFromAgent = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    name: v.string(),
    description: v.optional(v.string()),
    trigger: v.object({
      event: v.string(),
      filter: v.optional(v.any()),
    }),
    actions: v.array(actionValidator),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const existing = await ctx.db
      .query("automations")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    if (existing.length >= 30) throw new Error("Maximum 30 automations per agent");

    return await ctx.db.insert("automations", {
      agentId: args.agentId,
      name: args.name.substring(0, 200),
      description: args.description?.substring(0, 1000),
      trigger: args.trigger,
      actions: args.actions.slice(0, 10),
      isActive: true,
      runCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const listForAgent = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("automations")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const deleteFromAgent = mutation({
  args: {
    serverToken: v.string(),
    automationId: v.id("automations"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const automation = await ctx.db.get(args.automationId);
    if (!automation) throw new Error("Automation not found");
    await ctx.db.delete(args.automationId);
  },
});

// Server-facing: record that an automation ran
export const recordRun = mutation({
  args: { serverToken: v.string(), automationId: v.id("automations") },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const automation = await ctx.db.get(args.automationId);
    if (!automation) return;
    await ctx.db.patch(args.automationId, {
      runCount: automation.runCount + 1,
      lastRunAt: Date.now(),
    });
  },
});
