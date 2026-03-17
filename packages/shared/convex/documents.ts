import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";

const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  pro: 50,
  enterprise: 500,
};

export const upload = mutation({
  args: {
    agentId: v.id("agents"),
    fileName: v.string(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Agent not found");
    }

    // Enforce plan limits
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const limit = PLAN_LIMITS[user.plan] ?? 5;
    if (existing.length >= limit) {
      throw new Error(
        `Document limit reached (${limit} for ${user.plan} plan). Upgrade to upload more.`
      );
    }

    return await ctx.db.insert("documents", {
      agentId: args.agentId,
      fileName: args.fileName,
      fileType: args.fileType,
      storageId: args.storageId,
      fileSize: args.fileSize,
      status: "uploading",
      uploadedAt: Date.now(),
    });
  },
});

export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];

    return await ctx.db
      .query("documents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    const agent = await ctx.db.get(doc.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Delete all chunks
    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete storage file
    await ctx.storage.delete(doc.storageId);

    // Delete document record
    await ctx.db.delete(args.documentId);
  },
});
