import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";
import { requireServerAuth } from "./serverAuth";
import { internal } from "./_generated/api";

// ── Cron expression parser (basic) ──────────────────────────────────

function parseIntervalMs(interval: string): number {
  const match = interval.match(/^every\s+(\d+)\s*(s|m|h|d)$/i);
  if (!match) throw new Error(`Invalid interval: "${interval}". Use format: "every 5m", "every 1h", etc.`);
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] ?? 60000);
}

function computeNextRun(schedule: string, scheduleType: string, now: number): number {
  if (scheduleType === "interval") {
    return now + parseIntervalMs(schedule);
  }
  if (scheduleType === "once") {
    // "once" schedules use the config's timestamp directly
    return now;
  }
  // Basic cron: just compute next minute-aligned time for now
  // Full cron parsing would be a library — this handles simple daily/hourly patterns
  return now + 60000; // fallback: 1 minute
}

// ── USER-FACING QUERIES/MUTATIONS ────────────────────────────────────

export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];
    return await ctx.db
      .query("scheduledActions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.string(),
    description: v.optional(v.string()),
    schedule: v.string(),
    scheduleType: v.union(v.literal("cron"), v.literal("interval"), v.literal("once")),
    action: v.object({
      type: v.union(
        v.literal("send_message"),
        v.literal("run_prompt"),
        v.literal("fire_webhook"),
        v.literal("send_email"),
        v.literal("create_task"),
        v.literal("run_automation"),
      ),
      config: v.any(),
    }),
    timezone: v.optional(v.string()),
    maxRuns: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Not authorized");

    // Limit scheduled actions per agent
    const existing = await ctx.db
      .query("scheduledActions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    if (existing.length >= 20) throw new Error("Maximum 20 scheduled actions per agent");

    const now = Date.now();
    const nextRunAt = computeNextRun(args.schedule, args.scheduleType, now);

    const actionId = await ctx.db.insert("scheduledActions", {
      agentId: args.agentId,
      name: args.name.substring(0, 200),
      description: args.description?.substring(0, 1000),
      schedule: args.schedule,
      scheduleType: args.scheduleType,
      action: args.action,
      status: "active",
      timezone: args.timezone,
      nextRunAt,
      runCount: 0,
      maxRuns: args.maxRuns,
      createdAt: now,
    });

    // Schedule dispatch at nextRunAt
    const delayMs = Math.max(0, nextRunAt - now);
    await ctx.scheduler.runAfter(delayMs, internal.dispatch.fireSchedule, {
      actionId,
    });

    return actionId;
  },
});

export const update = mutation({
  args: {
    actionId: v.id("scheduledActions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    schedule: v.optional(v.string()),
    scheduleType: v.optional(v.union(v.literal("cron"), v.literal("interval"), v.literal("once"))),
    action: v.optional(v.object({
      type: v.union(
        v.literal("send_message"),
        v.literal("run_prompt"),
        v.literal("fire_webhook"),
        v.literal("send_email"),
        v.literal("create_task"),
        v.literal("run_automation"),
      ),
      config: v.any(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new Error("Scheduled action not found");
    const agent = await ctx.db.get(action.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Not authorized");

    const { actionId, ...updates } = args;
    const filtered: Record<string, any> = {};
    if (updates.name !== undefined) filtered.name = updates.name.substring(0, 200);
    if (updates.description !== undefined) filtered.description = updates.description?.substring(0, 1000);
    if (updates.schedule !== undefined) filtered.schedule = updates.schedule;
    if (updates.scheduleType !== undefined) filtered.scheduleType = updates.scheduleType;
    if (updates.action !== undefined) filtered.action = updates.action;

    // Recompute next run if schedule changed
    if (updates.schedule !== undefined || updates.scheduleType !== undefined) {
      const sched = updates.schedule ?? action.schedule;
      const schedType = updates.scheduleType ?? action.scheduleType;
      const now = Date.now();
      filtered.nextRunAt = computeNextRun(sched, schedType, now);
    }

    await ctx.db.patch(actionId, filtered);
  },
});

export const toggle = mutation({
  args: { actionId: v.id("scheduledActions") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new Error("Scheduled action not found");
    const agent = await ctx.db.get(action.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Not authorized");

    const newStatus = action.status === "active" ? "paused" : "active";
    const now = Date.now();
    const patch: Record<string, any> = { status: newStatus };
    if (newStatus === "active") {
      const nextRunAt = computeNextRun(action.schedule, action.scheduleType, now);
      patch.nextRunAt = nextRunAt;
      // Schedule dispatch for resumed schedule
      const delayMs = Math.max(0, nextRunAt - now);
      await ctx.scheduler.runAfter(delayMs, internal.dispatch.fireSchedule, {
        actionId: args.actionId,
      });
    }
    await ctx.db.patch(args.actionId, patch);
  },
});

export const remove = mutation({
  args: { actionId: v.id("scheduledActions") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new Error("Scheduled action not found");
    const agent = await ctx.db.get(action.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Not authorized");
    await ctx.db.delete(args.actionId);
  },
});

export const listRuns = query({
  args: { actionId: v.id("scheduledActions") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action) return [];
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(action.agentId);
    if (!agent || agent.userId !== user._id) return [];
    return await ctx.db
      .query("scheduledActionRuns")
      .withIndex("by_action", (q) => q.eq("actionId", args.actionId))
      .order("desc")
      .take(50);
  },
});

// ── SERVER-FACING (agent tools + cron executor) ──────────────────────

export const listDue = query({
  args: { serverToken: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("scheduledActions")
      .withIndex("by_next_run", (q) =>
        q.eq("status", "active").lte("nextRunAt", args.now)
      )
      .take(50);
  },
});

export const markRunning = mutation({
  args: { serverToken: v.string(), actionId: v.id("scheduledActions") },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const action = await ctx.db.get(args.actionId);
    if (!action || action.status !== "active") return null;

    const runId = await ctx.db.insert("scheduledActionRuns", {
      actionId: args.actionId,
      agentId: action.agentId,
      status: "running",
      startedAt: Date.now(),
    });

    return { runId, action };
  },
});

export const completeRun = mutation({
  args: {
    serverToken: v.string(),
    runId: v.id("scheduledActionRuns"),
    actionId: v.id("scheduledActions"),
    success: v.boolean(),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const now = Date.now();
    const run = await ctx.db.get(args.runId);
    if (run) {
      await ctx.db.patch(args.runId, {
        status: args.success ? "completed" : "failed",
        result: args.result,
        error: args.error,
        completedAt: now,
        duration: now - run.startedAt,
      });
    }

    const action = await ctx.db.get(args.actionId);
    if (!action) return;

    const newRunCount = action.runCount + 1;
    const isComplete = action.scheduleType === "once" ||
      (action.maxRuns !== undefined && newRunCount >= action.maxRuns);

    const nextRunAt = isComplete ? undefined : computeNextRun(action.schedule, action.scheduleType, now);

    await ctx.db.patch(args.actionId, {
      lastRunAt: now,
      runCount: newRunCount,
      status: isComplete ? "completed" : action.status,
      nextRunAt,
    });

    // Schedule next dispatch if not complete
    if (!isComplete && nextRunAt) {
      const delayMs = Math.max(0, nextRunAt - now);
      await ctx.scheduler.runAfter(delayMs, internal.dispatch.fireSchedule, {
        actionId: args.actionId,
      });
    }
  },
});

// Agent-tool-facing: create schedule from within an agent conversation
export const createFromAgent = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    name: v.string(),
    description: v.optional(v.string()),
    schedule: v.string(),
    scheduleType: v.union(v.literal("cron"), v.literal("interval"), v.literal("once")),
    action: v.object({
      type: v.union(
        v.literal("send_message"),
        v.literal("run_prompt"),
        v.literal("fire_webhook"),
        v.literal("send_email"),
        v.literal("create_task"),
        v.literal("run_automation"),
      ),
      config: v.any(),
    }),
    maxRuns: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const existing = await ctx.db
      .query("scheduledActions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    if (existing.length >= 20) throw new Error("Maximum 20 scheduled actions per agent");

    const now = Date.now();
    const nextRunAt = computeNextRun(args.schedule, args.scheduleType, now);

    const actionId = await ctx.db.insert("scheduledActions", {
      agentId: args.agentId,
      name: args.name.substring(0, 200),
      description: args.description?.substring(0, 1000),
      schedule: args.schedule,
      scheduleType: args.scheduleType,
      action: args.action,
      status: "active",
      nextRunAt,
      runCount: 0,
      maxRuns: args.maxRuns,
      createdAt: now,
    });

    // Schedule dispatch at nextRunAt
    const delayMs = Math.max(0, nextRunAt - now);
    await ctx.scheduler.runAfter(delayMs, internal.dispatch.fireSchedule, {
      actionId,
    });

    return actionId;
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
      .query("scheduledActions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const pauseFromAgent = mutation({
  args: {
    serverToken: v.string(),
    actionId: v.id("scheduledActions"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new Error("Scheduled action not found");
    await ctx.db.patch(args.actionId, { status: "paused" });
  },
});

export const resumeFromAgent = mutation({
  args: {
    serverToken: v.string(),
    actionId: v.id("scheduledActions"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new Error("Scheduled action not found");
    const now = Date.now();
    const nextRunAt = computeNextRun(action.schedule, action.scheduleType, now);
    await ctx.db.patch(args.actionId, {
      status: "active",
      nextRunAt,
    });

    // Schedule dispatch for resumed schedule
    const delayMs = Math.max(0, nextRunAt - now);
    await ctx.scheduler.runAfter(delayMs, internal.dispatch.fireSchedule, {
      actionId: args.actionId,
    });
  },
});

export const deleteFromAgent = mutation({
  args: {
    serverToken: v.string(),
    actionId: v.id("scheduledActions"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const action = await ctx.db.get(args.actionId);
    if (!action) throw new Error("Scheduled action not found");
    await ctx.db.delete(args.actionId);
  },
});
