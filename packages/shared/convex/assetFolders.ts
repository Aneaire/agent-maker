import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";

export const list = query({
  args: {
    agentId: v.id("agents"),
    parentId: v.optional(v.id("assetFolders")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];

    return await ctx.db
      .query("assetFolders")
      .withIndex("by_parent", (q) => {
        const q2 = q.eq("agentId", args.agentId);
        return args.parentId ? q2.eq("parentId", args.parentId) : q2;
      })
      .collect();
  },
});

export const listAll = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];

    return await ctx.db
      .query("assetFolders")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.string(),
    parentId: v.optional(v.id("assetFolders")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Agent not found");
    }

    return await ctx.db.insert("assetFolders", {
      agentId: args.agentId,
      name: args.name,
      parentId: args.parentId,
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    folderId: v.id("assetFolders"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    const agent = await ctx.db.get(folder.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.folderId, { name: args.name });
  },
});

export const remove = mutation({
  args: { folderId: v.id("assetFolders") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    const agent = await ctx.db.get(folder.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Move assets in this folder to root
    const assets = await ctx.db
      .query("assets")
      .withIndex("by_folder", (q) =>
        q.eq("agentId", folder.agentId).eq("folderId", args.folderId)
      )
      .collect();
    for (const asset of assets) {
      await ctx.db.patch(asset._id, { folderId: undefined });
    }

    // Move sub-folders to root
    const subFolders = await ctx.db
      .query("assetFolders")
      .withIndex("by_parent", (q) =>
        q.eq("agentId", folder.agentId).eq("parentId", args.folderId)
      )
      .collect();
    for (const sub of subFolders) {
      await ctx.db.patch(sub._id, { parentId: folder.parentId });
    }

    await ctx.db.delete(args.folderId);
  },
});
