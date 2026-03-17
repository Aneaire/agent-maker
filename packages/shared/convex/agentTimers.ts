import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerAuth } from "./serverAuth";

// ── Timers / Delayed Actions ─────────────────────────────────────────
// "Wait 5 minutes then follow up", "Remind me tomorrow at 9am"

const actionValidator = v.object({
  type: v.union(
    v.literal("send_message"),
    v.literal("send_email"),
    v.literal("create_task"),
    v.literal("fire_webhook"),
    v.literal("run_prompt"),
  ),
  config: v.any(),
});

// Server-facing: create a timer from agent tools
export const create = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    conversationId: v.optional(v.id("conversations")),
    label: v.string(),
    delayMs: v.optional(v.number()),     // Delay from now in ms
    fireAt: v.optional(v.number()),       // Absolute timestamp
    action: actionValidator,
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    // Limit timers per agent
    const existing = await ctx.db
      .query("agentTimers")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const active = existing.filter((t) => t.status === "waiting");
    if (active.length >= 50) throw new Error("Maximum 50 active timers per agent");

    const now = Date.now();
    const fireAt = args.fireAt ?? (args.delayMs ? now + args.delayMs : now + 60000);

    return await ctx.db.insert("agentTimers", {
      agentId: args.agentId,
      conversationId: args.conversationId,
      label: args.label.substring(0, 200),
      fireAt,
      action: args.action,
      status: "waiting",
      createdAt: now,
    });
  },
});

// Server-facing: list active timers
export const listForAgent = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const timers = await ctx.db
      .query("agentTimers")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    return timers.filter((t) => t.status === "waiting");
  },
});

// Server-facing: cancel a timer
export const cancel = mutation({
  args: {
    serverToken: v.string(),
    timerId: v.id("agentTimers"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const timer = await ctx.db.get(args.timerId);
    if (!timer) throw new Error("Timer not found");
    if (timer.status !== "waiting") throw new Error("Timer already fired or cancelled");
    await ctx.db.patch(args.timerId, { status: "cancelled" });
  },
});

// Server-facing: find due timers
export const listDue = query({
  args: { serverToken: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("agentTimers")
      .withIndex("by_status_fire", (q) =>
        q.eq("status", "waiting").lte("fireAt", args.now)
      )
      .take(50);
  },
});

// Server-facing: mark timer as fired
export const markFired = mutation({
  args: { serverToken: v.string(), timerId: v.id("agentTimers") },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const timer = await ctx.db.get(args.timerId);
    if (!timer || timer.status !== "waiting") return null;
    await ctx.db.patch(args.timerId, {
      status: "fired",
      firedAt: Date.now(),
    });
    return timer;
  },
});
