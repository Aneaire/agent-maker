import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";

// ── Unified Execution History ──────────────────────────────────────
// Combines automation runs and scheduled action runs into a single
// chronological execution feed.

export const list = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("automation"),
        v.literal("schedule")
      )
    ),
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];

    const limit = args.limit ?? 100;
    const filter = args.filter ?? "all";
    const statusFilter = args.status ?? "all";

    type Execution = {
      _id: string;
      kind: "automation" | "schedule";
      name: string;
      status: "running" | "completed" | "failed";
      startedAt: number;
      completedAt?: number;
      duration?: number;
      result?: string;
      error?: string;
      // Automation-specific
      triggerEvent?: string;
      triggerPayload?: any;
      actionsExecuted?: Array<{
        type: string;
        status: "completed" | "failed" | "skipped";
        result?: string;
        error?: string;
        duration?: number;
      }>;
      // Schedule-specific
      scheduleType?: string;
      schedule?: string;
      actionType?: string;
    };

    const executions: Execution[] = [];

    // Fetch automation runs
    if (filter === "all" || filter === "automation") {
      const autoRuns = await ctx.db
        .query("automationRuns")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
        .order("desc")
        .take(limit);

      // Get automation names
      const autoIds = [...new Set(autoRuns.map((r) => r.automationId))];
      const autoMap = new Map<string, string>();
      for (const id of autoIds) {
        const auto = await ctx.db.get(id);
        if (auto) autoMap.set(id, auto.name);
      }

      for (const run of autoRuns) {
        if (statusFilter !== "all" && run.status !== statusFilter) continue;
        executions.push({
          _id: run._id,
          kind: "automation",
          name: autoMap.get(run.automationId) ?? "Deleted automation",
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          duration: run.duration,
          result: run.result,
          error: run.error,
          triggerEvent: run.triggerEvent,
          triggerPayload: run.triggerPayload,
          actionsExecuted: run.actionsExecuted,
        });
      }
    }

    // Fetch scheduled action runs
    if (filter === "all" || filter === "schedule") {
      const schedRuns = await ctx.db
        .query("scheduledActionRuns")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
        .order("desc")
        .take(limit);

      // Get action names & metadata
      const actionIds = [...new Set(schedRuns.map((r) => r.actionId))];
      const actionMap = new Map<string, { name: string; scheduleType: string; schedule: string; actionType: string }>();
      for (const id of actionIds) {
        const action = await ctx.db.get(id);
        if (action) {
          actionMap.set(id, {
            name: action.name,
            scheduleType: action.scheduleType,
            schedule: action.schedule,
            actionType: action.action.type,
          });
        }
      }

      for (const run of schedRuns) {
        if (statusFilter !== "all" && run.status !== statusFilter) continue;
        const meta = actionMap.get(run.actionId);
        executions.push({
          _id: run._id,
          kind: "schedule",
          name: meta?.name ?? "Deleted schedule",
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          duration: run.duration,
          result: run.result,
          error: run.error,
          scheduleType: meta?.scheduleType,
          schedule: meta?.schedule,
          actionType: meta?.actionType,
        });
      }
    }

    // Sort by startedAt descending
    executions.sort((a, b) => b.startedAt - a.startedAt);

    return executions.slice(0, limit);
  },
});

// Get execution stats for the agent
export const stats = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id)
      return { total: 0, completed: 0, failed: 0, running: 0 };

    const autoRuns = await ctx.db
      .query("automationRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const schedRuns = await ctx.db
      .query("scheduledActionRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const allRuns = [...autoRuns, ...schedRuns];
    return {
      total: allRuns.length,
      completed: allRuns.filter((r) => r.status === "completed").length,
      failed: allRuns.filter((r) => r.status === "failed").length,
      running: allRuns.filter((r) => r.status === "running").length,
    };
  },
});
