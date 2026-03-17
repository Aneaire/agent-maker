import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getChunkWithDoc = internalQuery({
  args: { chunkId: v.id("documentChunks") },
  handler: async (ctx, args) => {
    const chunk = await ctx.db.get(args.chunkId);
    if (!chunk) return null;
    const doc = await ctx.db.get(chunk.documentId);
    return {
      content: chunk.content,
      fileName: doc?.fileName ?? "Unknown",
    };
  },
});
