import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";
import { internal } from "./_generated/api";

async function requireTabAccess(
  ctx: any,
  tabId: string
) {
  const user = await requireAuthUser(ctx);
  const tab = await ctx.db.get(tabId);
  if (!tab) throw new Error("Tab not found");
  const agent = await ctx.db.get(tab.agentId);
  if (!agent || agent.userId !== user._id) throw new Error("Not authorized");
  return { user, tab, agent };
}

export const list = query({
  args: { tabId: v.id("sidebarTabs") },
  handler: async (ctx, args) => {
    await requireTabAccess(ctx, args.tabId);
    const tasks = await ctx.db
      .query("tabTasks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    return tasks.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const listByStatus = query({
  args: {
    tabId: v.id("sidebarTabs"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await requireTabAccess(ctx, args.tabId);
    const tasks = await ctx.db
      .query("tabTasks")
      .withIndex("by_tab_status", (q) =>
        q.eq("tabId", args.tabId).eq("status", args.status)
      )
      .collect();
    return tasks.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const create = mutation({
  args: {
    tabId: v.id("sidebarTabs"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { tab } = await requireTabAccess(ctx, args.tabId);

    const existing = await ctx.db
      .query("tabTasks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();

    const maxOrder = existing.reduce(
      (max, t) => Math.max(max, t.sortOrder),
      -1
    );

    const taskId = await ctx.db.insert("tabTasks", {
      tabId: args.tabId,
      agentId: tab.agentId,
      title: args.title,
      description: args.description,
      status: args.status ?? "todo",
      priority: args.priority,
      tags: args.tags,
      sortOrder: maxOrder + 1,
    });

    const eventPayload = {
      taskId,
      title: args.title,
      description: args.description,
      status: args.status ?? "todo",
      priority: args.priority,
      tags: args.tags,
    };

    // Fire outgoing webhooks
    await ctx.scheduler.runAfter(0, internal.webhookFire.fire, {
      tabId: args.tabId,
      event: "task.created",
      payload: eventPayload,
    });

    // Emit event directly to event bus (shows in workflow page)
    await ctx.scheduler.runAfter(0, internal.agentEvents.emitInternal, {
      agentId: tab.agentId,
      event: "task.created",
      source: "ui",
      payload: eventPayload,
    });

    // Process automations natively in Convex (no HTTP to agent server needed)
    await ctx.scheduler.runAfter(0, internal.processAutomation.processEvent, {
      agentId: tab.agentId,
      event: "task.created",
      payload: eventPayload,
    });

    return taskId;
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tabTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    tags: v.optional(v.array(v.string())),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await requireTabAccess(ctx, task.tabId);

    const { taskId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(taskId, filtered);

    // Full task data after the update — so automations can read all fields
    const eventPayload = {
      taskId: args.taskId,
      title: (filtered.title as string) ?? task.title,
      description: (filtered.description as string) ?? task.description,
      status: (filtered.status as string) ?? task.status,
      priority: (filtered.priority as string) ?? task.priority,
      tags: (filtered.tags as string[]) ?? task.tags,
      tabId: task.tabId,
      changed: Object.keys(filtered),
    };

    // Fire outgoing webhooks
    await ctx.scheduler.runAfter(0, internal.webhookFire.fire, {
      tabId: task.tabId,
      event: "task.updated",
      payload: eventPayload,
    });

    // Emit event directly to event bus (shows in workflow page)
    await ctx.scheduler.runAfter(0, internal.agentEvents.emitInternal, {
      agentId: task.agentId,
      event: "task.updated",
      source: "ui",
      payload: eventPayload,
    });

    // Process automations natively in Convex (no HTTP to agent server needed)
    await ctx.scheduler.runAfter(0, internal.processAutomation.processEvent, {
      agentId: task.agentId,
      event: "task.updated",
      payload: eventPayload,
    });
  },
});

export const remove = mutation({
  args: { taskId: v.id("tabTasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await requireTabAccess(ctx, task.tabId);
    await ctx.db.delete(args.taskId);

    // Full task data before deletion — so automations can read all fields
    const eventPayload = {
      taskId: args.taskId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      tags: task.tags,
      tabId: task.tabId,
    };

    // Fire outgoing webhooks
    await ctx.scheduler.runAfter(0, internal.webhookFire.fire, {
      tabId: task.tabId,
      event: "task.deleted",
      payload: eventPayload,
    });

    // Emit event directly to event bus (shows in workflow page)
    await ctx.scheduler.runAfter(0, internal.agentEvents.emitInternal, {
      agentId: task.agentId,
      event: "task.deleted",
      source: "ui",
      payload: eventPayload,
    });

    // Process automations natively in Convex (no HTTP to agent server needed)
    await ctx.scheduler.runAfter(0, internal.processAutomation.processEvent, {
      agentId: task.agentId,
      event: "task.deleted",
      payload: eventPayload,
    });
  },
});
