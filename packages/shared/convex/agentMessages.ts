import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";
import { requireServerAuth } from "./serverAuth";

// ── Inter-Agent Messaging ────────────────────────────────────────────
// Agents can send messages to other agents, enabling multi-agent workflows.

// Server-facing: send message from one agent to another
export const send = mutation({
  args: {
    serverToken: v.string(),
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    content: v.string(),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    // Verify both agents exist and belong to the same user
    const fromAgent = await ctx.db.get(args.fromAgentId);
    const toAgent = await ctx.db.get(args.toAgentId);
    if (!fromAgent || !toAgent) throw new Error("Agent not found");
    if (fromAgent.userId !== toAgent.userId) {
      throw new Error("Can only message agents owned by the same user");
    }

    // Limit pending messages
    const pending = await ctx.db
      .query("agentMessages")
      .withIndex("by_to_agent", (q) =>
        q.eq("toAgentId", args.toAgentId).eq("status", "pending")
      )
      .collect();
    if (pending.length >= 50) {
      throw new Error("Target agent has too many pending messages");
    }

    return await ctx.db.insert("agentMessages", {
      fromAgentId: args.fromAgentId,
      toAgentId: args.toAgentId,
      content: args.content.substring(0, 10000),
      context: args.context,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// Server-facing: list pending messages for an agent
export const listPending = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("agentMessages")
      .withIndex("by_to_agent", (q) =>
        q.eq("toAgentId", args.agentId).eq("status", "pending")
      )
      .take(10);
  },
});

// Server-facing: mark message as processed with optional response
export const markProcessed = mutation({
  args: {
    serverToken: v.string(),
    messageId: v.id("agentMessages"),
    response: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");
    await ctx.db.patch(args.messageId, {
      status: "processed",
      response: args.response?.substring(0, 10000),
      processedAt: Date.now(),
    });
  },
});

// Server-facing: list agents the current agent can message
export const listSiblingAgents = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return [];
    const siblings = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", agent.userId))
      .collect();
    return siblings
      .filter((a) => a._id !== args.agentId && a.status === "active")
      .map((a) => ({
        id: a._id,
        name: a.name,
        description: a.description,
      }));
  },
});

// User-facing: view inter-agent message history
export const listForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];

    const sent = await ctx.db
      .query("agentMessages")
      .withIndex("by_from_agent", (q) => q.eq("fromAgentId", args.agentId))
      .order("desc")
      .take(25);
    const received = await ctx.db
      .query("agentMessages")
      .withIndex("by_to_agent", (q) => q.eq("toAgentId", args.agentId))
      .order("desc")
      .take(25);

    return { sent, received };
  },
});
