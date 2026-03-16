import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateAuthUser, requireAuthUser } from "./auth";

export const start = mutation({
  handler: async (ctx) => {
    const user = await getOrCreateAuthUser(ctx);

    // Check plan limits
    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const activeAgents = existingAgents.filter((a) => a.status !== "draft");
    if (activeAgents.length >= user.maxAgents) {
      throw new Error(
        `Agent limit reached (${user.maxAgents}). Upgrade your plan to create more agents.`
      );
    }

    // Abandon any existing active creator sessions
    const activeSessions = await ctx.db
      .query("creatorSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const session of activeSessions) {
      if (session.status === "active") {
        await ctx.db.patch(session._id, { status: "abandoned" });
        // Clean up the draft agent and its associated data
        if (session.agentId) {
          const draftAgent = await ctx.db.get(session.agentId);
          if (draftAgent && draftAgent.status === "draft") {
            // Delete conversation + messages
            if (session.conversationId) {
              const messages = await ctx.db
                .query("messages")
                .withIndex("by_conversation", (q) =>
                  q.eq("conversationId", session.conversationId!)
                )
                .collect();
              for (const msg of messages) {
                await ctx.db.delete(msg._id);
              }
              await ctx.db.delete(session.conversationId);
            }

            // Delete jobs
            const jobs = await ctx.db
              .query("agentJobs")
              .withIndex("by_agent", (q) =>
                q.eq("agentId", session.agentId!)
              )
              .collect();
            for (const job of jobs) {
              await ctx.db.delete(job._id);
            }

            await ctx.db.delete(session.agentId);
          }
        }
      }
    }

    // Create draft agent
    const agentId = await ctx.db.insert("agents", {
      userId: user._id,
      name: "New Agent",
      slug: `draft-${Date.now()}`,
      systemPrompt: "You are a helpful AI assistant.",
      model: "claude-sonnet-4-6",
      enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools"],
      status: "draft",
    });

    // Create conversation for the creator chat
    const conversationId = await ctx.db.insert("conversations", {
      agentId,
      userId: user._id,
      title: "Agent Creator",
    });

    // Create session
    const sessionId = await ctx.db.insert("creatorSessions", {
      userId: user._id,
      status: "active",
      agentId,
      conversationId,
      partialConfig: {
        name: "New Agent",
        systemPrompt: "You are a helpful AI assistant.",
        model: "claude-sonnet-4-6",
        enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools"],
      },
    });

    // Auto-send a trigger message so the creator agent greets the user
    const userMessageId = await ctx.db.insert("messages", {
      conversationId,
      role: "user",
      content: "Hi, I'd like to create a new agent.",
      status: "done",
    });

    const assistantMessageId = await ctx.db.insert("messages", {
      conversationId,
      role: "assistant",
      content: "",
      status: "pending",
    });

    await ctx.db.insert("agentJobs", {
      agentId,
      conversationId,
      messageId: assistantMessageId,
      userId: user._id,
      status: "pending",
    });

    return { sessionId, agentId, conversationId };
  },
});

export const get = query({
  args: { sessionId: v.id("creatorSessions") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) return null;
    return session;
  },
});

export const getByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const sessions = await ctx.db
      .query("creatorSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return sessions.find((s) => s.conversationId === args.conversationId) ?? null;
  },
});

export const abandon = mutation({
  args: { sessionId: v.id("creatorSessions") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, { status: "abandoned" });

    // Delete draft agent
    if (session.agentId) {
      const agent = await ctx.db.get(session.agentId);
      if (agent && agent.status === "draft") {
        // Delete conversation + messages
        if (session.conversationId) {
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) =>
              q.eq("conversationId", session.conversationId!)
            )
            .collect();
          for (const msg of messages) {
            await ctx.db.delete(msg._id);
          }
          await ctx.db.delete(session.conversationId);
        }

        // Delete jobs
        const jobs = await ctx.db
          .query("agentJobs")
          .withIndex("by_agent", (q) => q.eq("agentId", session.agentId!))
          .collect();
        for (const job of jobs) {
          await ctx.db.delete(job._id);
        }

        await ctx.db.delete(session.agentId);
      }
    }
  },
});
