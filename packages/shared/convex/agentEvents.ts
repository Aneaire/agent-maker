import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";
import { requireServerAuth } from "./serverAuth";

// ── Event Bus ────────────────────────────────────────────────────────
// Unified event system. Every tool action emits events here.
// Automations subscribe to events and trigger actions.

// Server-facing: emit an event (called by agent tools)
export const emit = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    event: v.string(),
    source: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const eventId = await ctx.db.insert("agentEvents", {
      agentId: args.agentId,
      event: args.event,
      source: args.source,
      payload: args.payload,
      createdAt: Date.now(),
    });

    return eventId;
  },
});

// ────────────────────────────────────────────────────────────────────

// User-facing: list recent events for an agent
export const list = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];
    return await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// User-facing: list events by type
export const listByEvent = query({
  args: {
    agentId: v.id("agents"),
    event: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];
    return await ctx.db
      .query("agentEvents")
      .withIndex("by_agent_event", (q) =>
        q.eq("agentId", args.agentId).eq("event", args.event)
      )
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Server-facing: list recent events (for agent tools to read)
export const listForAgent = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    event: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    if (args.event) {
      return await ctx.db
        .query("agentEvents")
        .withIndex("by_agent_event", (q) =>
          q.eq("agentId", args.agentId).eq("event", args.event)
        )
        .order("desc")
        .take(args.limit ?? 20);
    }
    return await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// Server-facing: cleanup old events (keep last 7 days)
export const cleanup = mutation({
  args: { serverToken: v.string() },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("agentEvents")
      .withIndex("by_created", (q) => q.lte("createdAt", cutoff))
      .take(100);
    for (const event of old) {
      await ctx.db.delete(event._id);
    }
    return old.length;
  },
});
