import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";
import { requireServerAuth } from "./serverAuth";

// ── User-facing queries ─────────────────────────────────────────────

export const list = query({
  args: {
    agentId: v.id("agents"),
    folderId: v.optional(v.id("assetFolders")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_folder", (q) => {
        const q2 = q.eq("agentId", args.agentId);
        return args.folderId ? q2.eq("folderId", args.folderId) : q2;
      })
      .collect();

    // Resolve storage URLs
    const results = [];
    for (const asset of assets) {
      let resolvedUrl = asset.url;
      if (!resolvedUrl && asset.storageId) {
        resolvedUrl = await ctx.storage.getUrl(asset.storageId) ?? undefined;
      }
      results.push({ ...asset, resolvedUrl });
    }
    return results;
  },
});

export const get = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset) return null;

    const agent = await ctx.db.get(asset.agentId);
    if (!agent || agent.userId !== user._id) return null;

    let resolvedUrl = asset.url;
    if (!resolvedUrl && asset.storageId) {
      resolvedUrl = await ctx.storage.getUrl(asset.storageId) ?? undefined;
    }
    return { ...asset, resolvedUrl };
  },
});

// ── User-facing mutations ───────────────────────────────────────────

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    folderId: v.optional(v.id("assetFolders")),
    name: v.string(),
    type: v.union(v.literal("image"), v.literal("file")),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    generatedBy: v.optional(v.union(v.literal("gemini"), v.literal("nano_banana"))),
    prompt: v.optional(v.string()),
    model: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Agent not found");
    }

    return await ctx.db.insert("assets", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const move = mutation({
  args: {
    assetId: v.id("assets"),
    folderId: v.optional(v.id("assetFolders")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new Error("Asset not found");

    const agent = await ctx.db.get(asset.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.assetId, { folderId: args.folderId });
  },
});

export const rename = mutation({
  args: {
    assetId: v.id("assets"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new Error("Asset not found");

    const agent = await ctx.db.get(asset.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.assetId, { name: args.name });
  },
});

export const remove = mutation({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new Error("Asset not found");

    const agent = await ctx.db.get(asset.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Not authorized");
    }

    if (asset.storageId) {
      await ctx.storage.delete(asset.storageId);
    }
    await ctx.db.delete(args.assetId);
  },
});

// ── Server-facing mutations (for agent tools) ──────────────────────

export const serverCreate = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    folderId: v.optional(v.id("assetFolders")),
    name: v.string(),
    type: v.union(v.literal("image"), v.literal("file")),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    generatedBy: v.optional(v.union(v.literal("gemini"), v.literal("nano_banana"))),
    prompt: v.optional(v.string()),
    model: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const { serverToken, ...rest } = args;

    return await ctx.db.insert("assets", {
      ...rest,
      createdAt: Date.now(),
    });
  },
});

export const serverList = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const results = [];
    for (const asset of assets) {
      let resolvedUrl = asset.url;
      if (!resolvedUrl && asset.storageId) {
        resolvedUrl = await ctx.storage.getUrl(asset.storageId) ?? undefined;
      }
      results.push({ ...asset, resolvedUrl });
    }
    return results;
  },
});

export const serverGetUploadUrl = mutation({
  args: { serverToken: v.string() },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.storage.generateUploadUrl();
  },
});
