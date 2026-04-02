import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ── Internal query: get asset by ID ───────────────────────────────────

export const _getAsset = internalQuery({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.assetId);
  },
});

// ── Internal mutation: update tool call output on a message ────────────

export const _updateToolCallOutput = internalMutation({
  args: {
    messageId: v.id("messages"),
    toolCallId: v.string(),
    output: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg || !msg.toolCalls) return;

    const updatedToolCalls = (msg.toolCalls as any[]).map((tc: any) => {
      if (tc.id === args.toolCallId) {
        return { ...tc, output: args.output };
      }
      return tc;
    });

    await ctx.db.patch(args.messageId, { toolCalls: updatedToolCalls });
  },
});

// ── Internal mutation: create asset ────────────────────────────────────

export const _createAsset = internalMutation({
  args: {
    agentId: v.id("agents"),
    name: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    fileSize: v.number(),
    generatedBy: v.union(v.literal("gemini"), v.literal("nano_banana")),
    prompt: v.string(),
    model: v.string(),
    width: v.number(),
    height: v.number(),
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("assets", {
      agentId: args.agentId,
      name: args.name,
      type: "image" as const,
      storageId: args.storageId,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      generatedBy: args.generatedBy,
      prompt: args.prompt,
      model: args.model,
      width: args.width,
      height: args.height,
      ...(args.folderId ? { folderId: args.folderId as any } : {}),
      createdAt: Date.now(),
    });
  },
});
