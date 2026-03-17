import { internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const listOutgoing = internalQuery({
  args: {
    tabId: v.id("sidebarTabs"),
    event: v.string(),
  },
  handler: async (ctx, args) => {
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    return webhooks.filter(
      (w) => w.type === "outgoing" && w.isActive && w.events.includes(args.event)
    );
  },
});

export const fire = internalAction({
  args: {
    tabId: v.id("sidebarTabs"),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const webhooks = await ctx.runQuery(internal.webhookFire.listOutgoing, {
      tabId: args.tabId,
      event: args.event,
    });

    for (const wh of webhooks) {
      if (!wh.url) continue;
      try {
        await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: args.event,
            timestamp: new Date().toISOString(),
            data: args.payload,
          }),
        });
      } catch (err: any) {
        console.error(`[webhook] Outgoing to ${wh.url} failed:`, err.message);
      }
    }
  },
});
