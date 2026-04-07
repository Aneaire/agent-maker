import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser } from "./auth";
import { requireServerAuth } from "./serverAuth";

// ── User-facing queries (Clerk auth) ──────────────────────────────────

export const list = query({
  handler: async (ctx) => {
    const user = await requireAuthUser(ctx);
    const creds = await ctx.db
      .query("credentials")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return creds.map((c) => ({
      _id: c._id,
      name: c.name,
      type: c.type,
      status: c.status,
      lastTestedAt: c.lastTestedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },
});

export const listForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];

    const links = await ctx.db
      .query("agentCredentialLinks")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const results: Array<{
      _id: string;
      toolSetName: string;
      credentialId: string;
      credentialName: string;
      credentialType: string;
      status: string;
    }> = [];

    for (const link of links) {
      const cred = await ctx.db.get(link.credentialId);
      if (cred) {
        results.push({
          _id: link._id as string,
          toolSetName: link.toolSetName,
          credentialId: link.credentialId as string,
          credentialName: cred.name,
          credentialType: cred.type,
          status: cred.status,
        });
      }
    }
    return results;
  },
});

// ── User-facing mutations ─────────────────────────────────────────────

export const remove = mutation({
  args: { credentialId: v.id("credentials") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const cred = await ctx.db.get(args.credentialId);
    if (!cred || cred.userId !== user._id) {
      throw new Error("Credential not found");
    }

    const links = await ctx.db
      .query("agentCredentialLinks")
      .withIndex("by_credential", (q) => q.eq("credentialId", args.credentialId))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    await ctx.db.delete(args.credentialId);
  },
});

export const linkToAgent = mutation({
  args: {
    agentId: v.id("agents"),
    toolSetName: v.string(),
    credentialId: v.id("credentials"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Agent not found");
    const cred = await ctx.db.get(args.credentialId);
    if (!cred || cred.userId !== user._id) throw new Error("Credential not found");

    const existing = await ctx.db
      .query("agentCredentialLinks")
      .withIndex("by_agent_toolset", (q) =>
        q.eq("agentId", args.agentId).eq("toolSetName", args.toolSetName)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return await ctx.db.insert("agentCredentialLinks", {
      agentId: args.agentId,
      toolSetName: args.toolSetName,
      credentialId: args.credentialId,
    });
  },
});

export const unlinkFromAgent = mutation({
  args: {
    agentId: v.id("agents"),
    toolSetName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) throw new Error("Agent not found");

    const link = await ctx.db
      .query("agentCredentialLinks")
      .withIndex("by_agent_toolset", (q) =>
        q.eq("agentId", args.agentId).eq("toolSetName", args.toolSetName)
      )
      .unique();
    if (link) {
      await ctx.db.delete(link._id);
    }
  },
});

// ── Internal mutations/queries (called by actions in credentialActions.ts) ──

export const _insert = internalMutation({
  args: {
    name: v.string(),
    type: v.string(),
    encryptedData: v.string(),
    iv: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    return await ctx.db.insert("credentials", {
      userId: user._id,
      name: args.name,
      type: args.type,
      encryptedData: args.encryptedData,
      iv: args.iv,
      status: "untested",
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });
  },
});

export const _update = internalMutation({
  args: {
    credentialId: v.id("credentials"),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.credentialId, args.patch);
  },
});

/** Owner-checked fetch for the edit-credential UI flow */
export const _getForOwner = internalQuery({
  args: { credentialId: v.id("credentials") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const cred = await ctx.db.get(args.credentialId);
    if (!cred || cred.userId !== user._id) throw new Error("Credential not found");
    return cred;
  },
});

export const _get = internalQuery({
  args: { credentialId: v.id("credentials") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.credentialId);
  },
});

export const _getLinkByAgentToolset = internalQuery({
  args: {
    agentId: v.id("agents"),
    toolSetName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentCredentialLinks")
      .withIndex("by_agent_toolset", (q) =>
        q.eq("agentId", args.agentId).eq("toolSetName", args.toolSetName)
      )
      .unique();
  },
});

export const _insertOAuthState = internalMutation({
  args: {
    state: v.string(),
    provider: v.string(),
    scopes: v.array(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    return await ctx.db.insert("oauthStates", {
      userId: user._id,
      ...args,
    });
  },
});

export const _insertCredentialFromOAuth = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    type: v.string(),
    encryptedData: v.string(),
    iv: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("credentials", {
      userId: args.userId as any,
      name: args.name,
      type: args.type,
      encryptedData: args.encryptedData,
      iv: args.iv,
      status: "valid",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const _getOAuthState = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
  },
});

export const _deleteOAuthState = internalMutation({
  args: { id: v.id("oauthStates") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ── Server-facing OAuth helpers (called from Hono server) ─────────────

export const getOAuthState = query({
  args: {
    serverToken: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
  },
});

export const deleteOAuthState = mutation({
  args: {
    serverToken: v.string(),
    id: v.id("oauthStates"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    await ctx.db.delete(args.id);
  },
});

export const insertCredentialFromOAuth = mutation({
  args: {
    serverToken: v.string(),
    userId: v.id("users"),
    name: v.string(),
    type: v.string(),
    encryptedData: v.string(),
    iv: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const now = Date.now();
    return await ctx.db.insert("credentials", {
      userId: args.userId,
      name: args.name,
      type: args.type,
      encryptedData: args.encryptedData,
      iv: args.iv,
      status: "valid",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ── Migration internal helpers (called from credentialActions.ts) ──────

export const _listLegacyConfigs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthUser(ctx);
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const results: Array<{ agentId: string; toolSetName: string; config: any }> = [];
    for (const agent of agents) {
      const configs = await ctx.db
        .query("agentToolConfigs")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();
      for (const tc of configs) {
        results.push({
          agentId: agent._id as string,
          toolSetName: tc.toolSetName,
          config: tc.config,
        });
      }
    }
    return results;
  },
});

export const _writeMigratedCredentials = internalMutation({
  args: {
    credentials: v.array(v.object({
      dedupeKey: v.string(),
      encrypted: v.string(),
      iv: v.string(),
      name: v.string(),
      type: v.string(),
    })),
    links: v.array(v.object({
      agentId: v.string(),
      toolSetName: v.string(),
      dedupeKey: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const now = Date.now();

    const credMap = new Map<string, any>();
    let migrated = 0;

    for (const cred of args.credentials) {
      const credId = await ctx.db.insert("credentials", {
        userId: user._id,
        name: cred.name,
        type: cred.type,
        encryptedData: cred.encrypted,
        iv: cred.iv,
        status: "untested" as const,
        createdAt: now,
        updatedAt: now,
      });
      credMap.set(cred.dedupeKey, credId);
      migrated++;
    }

    let linked = 0;
    let skipped = 0;
    for (const link of args.links) {
      const existing = await ctx.db
        .query("agentCredentialLinks")
        .withIndex("by_agent_toolset", (q) =>
          q.eq("agentId", link.agentId as any).eq("toolSetName", link.toolSetName)
        )
        .unique();
      if (existing) { skipped++; continue; }

      const credId = credMap.get(link.dedupeKey);
      if (!credId) { skipped++; continue; }

      await ctx.db.insert("agentCredentialLinks", {
        agentId: link.agentId as any,
        toolSetName: link.toolSetName,
        credentialId: credId,
      });
      linked++;
    }

    return { migrated, linked, skipped };
  },
});

// ── Linked credentials for agent (used in agent deletion) ─────────────

export const deleteAllForAgent = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("agentCredentialLinks")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }
  },
});
