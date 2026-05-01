import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Checks if the authenticated user is an admin.
 * Checks ADMIN_EMAILS env var against JWT email, DB email, and Clerk user ID.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const adminIdentifiers = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  // Check JWT email
  const jwtEmail = identity.email?.toLowerCase();
  if (jwtEmail && adminIdentifiers.includes(jwtEmail)) {
    return identity;
  }

  // Check DB user email
  const clerkId = identity.subject;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();

  const dbEmail = user?.email?.toLowerCase();
  if (dbEmail && adminIdentifiers.includes(dbEmail)) {
    return identity;
  }

  // Check Clerk user ID directly
  if (adminIdentifiers.includes(clerkId.toLowerCase())) {
    return identity;
  }

  throw new Error("Not authorized: admin access required");
}
