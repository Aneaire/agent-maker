import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";

function generateSecret(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "whk_";
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function requireWebhookAccess(ctx: any, tabId: string) {
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
    await requireWebhookAccess(ctx, args.tabId);
    return await ctx.db
      .query("webhooks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
  },
});

export const create = mutation({
  args: {
    tabId: v.id("sidebarTabs"),
    type: v.union(v.literal("incoming"), v.literal("outgoing")),
    url: v.optional(v.string()),
    events: v.array(v.string()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tab } = await requireWebhookAccess(ctx, args.tabId);

    // Limit webhooks per tab
    const existing = await ctx.db
      .query("webhooks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    if (existing.length >= 10) {
      throw new Error("Maximum 10 webhooks per page");
    }

    // Outgoing webhooks require a URL
    if (args.type === "outgoing" && !args.url?.trim()) {
      throw new Error("Outgoing webhooks require a URL");
    }

    return await ctx.db.insert("webhooks", {
      agentId: tab.agentId,
      tabId: args.tabId,
      type: args.type,
      secret: generateSecret(),
      url: args.url?.trim(),
      events: args.events,
      isActive: true,
      label: args.label?.trim(),
      createdAt: Date.now(),
    });
  },
});

export const toggle = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");
    await requireWebhookAccess(ctx, webhook.tabId);
    await ctx.db.patch(args.webhookId, { isActive: !webhook.isActive });
  },
});

export const remove = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");
    await requireWebhookAccess(ctx, webhook.tabId);
    await ctx.db.delete(args.webhookId);
  },
});
