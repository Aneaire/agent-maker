import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requireAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const removeFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);
    await ctx.storage.delete(args.storageId);
  },
});
