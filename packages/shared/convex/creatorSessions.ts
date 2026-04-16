import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateAuthUser, requireAuthUser } from "./auth";
import { internal } from "./_generated/api";

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

    // Inherit the last-used creator model so the preference persists across sessions.
    const recentSessions = await ctx.db
      .query("creatorSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    const lastCreatorModel =
      recentSessions.find((s) => s.creatorModel)?.creatorModel ?? null;

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
      title: "Agent Builder",
    });

    // Create session
    const sessionId = await ctx.db.insert("creatorSessions", {
      userId: user._id,
      status: "active",
      mode: "create",
      agentId,
      conversationId,
      partialConfig: {
        name: "New Agent",
        systemPrompt: "You are a helpful AI assistant.",
        model: "claude-sonnet-4-6",
        enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools"],
      },
      ...(lastCreatorModel ? { creatorModel: lastCreatorModel } : {}),
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

    const jobId = await ctx.db.insert("agentJobs", {
      agentId,
      conversationId,
      messageId: assistantMessageId,
      userId: user._id,
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.dispatch.notifyJobCreated, {
      jobId,
    });

    return { sessionId, agentId, conversationId };
  },
});

export const startEdit = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await getOrCreateAuthUser(ctx);

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) {
      throw new Error("Agent not found");
    }
    if (agent.status !== "active") {
      throw new Error("Can only edit active agents");
    }

    // Abandon any existing active editor/creator sessions for this user
    const activeSessions = await ctx.db
      .query("creatorSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Inherit the last-used creator model so the preference persists across sessions.
    const lastCreatorModel =
      [...activeSessions]
        .sort((a, b) => b._creationTime - a._creationTime)
        .find((s) => s.creatorModel)?.creatorModel ?? null;

    for (const session of activeSessions) {
      if (session.status === "active") {
        // Mark as abandoned but preserve conversation history for edit sessions
        await ctx.db.patch(session._id, { status: "abandoned" });
      }
    }

    // Create conversation for the editor chat
    const conversationId = await ctx.db.insert("conversations", {
      agentId: args.agentId,
      userId: user._id,
      title: "Agent Builder",
    });

    // Build current config snapshot for the preview panel
    const tabs = await ctx.db
      .query("sidebarTabs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const partialConfig = {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      enabledToolSets: agent.enabledToolSets,
      iconUrl: agent.iconUrl,
      pages: tabs.map((t) => ({ label: t.label, type: t.type })),
    };

    // Create session in edit mode
    const sessionId = await ctx.db.insert("creatorSessions", {
      userId: user._id,
      status: "active",
      mode: "edit",
      agentId: args.agentId,
      conversationId,
      partialConfig,
      ...(lastCreatorModel ? { creatorModel: lastCreatorModel } : {}),
    });

    // Auto-send trigger message
    await ctx.db.insert("messages", {
      conversationId,
      role: "user",
      content: "Hi, I'd like to update my agent.",
      status: "done",
    });

    const assistantMessageId = await ctx.db.insert("messages", {
      conversationId,
      role: "assistant",
      content: "",
      status: "pending",
    });

    const jobId = await ctx.db.insert("agentJobs", {
      agentId: args.agentId,
      conversationId,
      messageId: assistantMessageId,
      userId: user._id,
      status: "pending",
    });

    await ctx.scheduler.runAfter(0, internal.dispatch.notifyJobCreated, {
      jobId,
    });

    return { sessionId, agentId: args.agentId, conversationId };
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

export const listByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.userId !== user._id) return [];

    const sessions = await ctx.db
      .query("creatorSessions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    // Return all non-active sessions (completed + abandoned that still have conversations)
    // sorted newest first
    const history = sessions
      .filter((s) => s.status !== "active" && s.conversationId)
      .sort((a, b) => b._creationTime - a._creationTime);

    // Enrich with message count and first user message preview
    const enriched = await Promise.all(
      history.map(async (s) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", s.conversationId!)
          )
          .collect();

        const firstUserMsg = messages.find(
          (m) => m.role === "user" && m.content !== "Hi, I'd like to update my agent." && m.content !== "Hi, I'd like to create a new agent."
        );

        return {
          _id: s._id,
          _creationTime: s._creationTime,
          status: s.status,
          mode: s.mode,
          conversationId: s.conversationId,
          messageCount: messages.length,
          preview: firstUserMsg?.content ?? (s.mode === "edit" ? "Edit session" : "Create session"),
        };
      })
    );

    return enriched;
  },
});

export const setCreatorModel = mutation({
  args: {
    sessionId: v.id("creatorSessions"),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }
    const partialConfig = session.partialConfig as Record<string, any> | undefined;
    await ctx.db.patch(args.sessionId, {
      creatorModel: args.model,
      partialConfig: { ...(partialConfig ?? {}), model: args.model },
    });
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

    // Keep conversation history for edit sessions so users can review past changes
    // Only clean up conversations for create-mode sessions (draft agents get deleted anyway)
    if (session.mode !== "edit" && session.conversationId) {
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

    // For create mode: also delete the draft agent
    if (session.mode !== "edit" && session.agentId) {
      const agent = await ctx.db.get(session.agentId);
      if (agent && agent.status === "draft") {
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
