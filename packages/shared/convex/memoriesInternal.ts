import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getById = internalQuery({
  args: { id: v.id("memories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
