import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { requireServerAuth } from "./serverAuth";
import { internal } from "./_generated/api";

// ── QUERIES ──────────────────────────────────────────────────────────

export const getAgent = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db.get(args.agentId);
  },
});

export const listMessages = query({
  args: {
    serverToken: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
  },
});

export const listMemories = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .take(20);
  },
});

export const searchMemories = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("memories")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query).eq("agentId", args.agentId)
      )
      .take(10);
  },
});

// ── MUTATIONS ────────────────────────────────────────────────────────

export const updateMessage = mutation({
  args: {
    serverToken: v.string(),
    messageId: v.id("messages"),
    content: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    toolCalls: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          input: v.string(),
          output: v.optional(v.string()),
          progress: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const msg = await ctx.db.get(args.messageId);
    if (
      msg &&
      msg.status === "done" &&
      (args.status === "processing" || args.status === "pending")
    ) {
      return { stopped: true };
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: args.status,
      ...(args.toolCalls !== undefined && { toolCalls: args.toolCalls }),
    });
    return { stopped: false };
  },
});

export const storeMemory = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    content: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db.insert("memories", {
      agentId: args.agentId,
      content: args.content,
      category: args.category,
    });
  },
});

// ── PAGE QUERIES ─────────────────────────────────────────────────────

export const listCustomTools = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("customTools")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const listTabs = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("sidebarTabs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const listTasks = query({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("tabTasks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
  },
});

export const listNotes = query({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("tabNotes")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
  },
});

export const listSpreadsheetData = query({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const columns = await ctx.db
      .query("tabSpreadsheetColumns")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    const rows = await ctx.db
      .query("tabSpreadsheetRows")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    return { columns, rows: rows.sort((a, b) => a.rowIndex - b.rowIndex) };
  },
});

// ── PAGE MUTATIONS (with ownership + size limits) ────────────────────

// Size limits
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_NOTE_CONTENT_LENGTH = 100000; // 100KB
const MAX_CELL_DATA_SIZE = 50000; // 50KB serialized
const MAX_TAB_CONFIG_SIZE = 200000; // 200KB
const MAX_TASKS_PER_TAB = 500;
const MAX_NOTES_PER_TAB = 200;

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return s;
  return s.length > max ? s.substring(0, max) : s;
}

async function requireTabOwnership(ctx: any, tabId: any, agentId: any) {
  const tab = await ctx.db.get(tabId);
  if (!tab) throw new Error("Tab not found");
  if (tab.agentId !== agentId) throw new Error("Tab does not belong to this agent");
  return tab;
}

export const createTask = mutation({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    await requireTabOwnership(ctx, args.tabId, args.agentId);

    const existing = await ctx.db
      .query("tabTasks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    if (existing.length >= MAX_TASKS_PER_TAB) {
      throw new Error(`Task limit reached (${MAX_TASKS_PER_TAB})`);
    }
    const maxOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1);
    return await ctx.db.insert("tabTasks", {
      tabId: args.tabId,
      agentId: args.agentId,
      title: truncate(args.title, MAX_TITLE_LENGTH)!,
      description: truncate(args.description, MAX_DESCRIPTION_LENGTH),
      status: args.status ?? "todo",
      priority: args.priority,
      sortOrder: maxOrder + 1,
    });
  },
});

export const getTask = query({
  args: {
    serverToken: v.string(),
    taskId: v.id("tabTasks"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    return task;
  },
});

export const getNote = query({
  args: {
    serverToken: v.string(),
    noteId: v.id("tabNotes"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const note = await ctx.db.get(args.noteId);
    if (!note) return null;
    return note;
  },
});

export const updateTask = mutation({
  args: {
    serverToken: v.string(),
    taskId: v.id("tabTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    // Verify ownership via tab
    const tab = await ctx.db.get(task.tabId);
    if (!tab) throw new Error("Tab not found");

    const { serverToken, taskId, ...updates } = args;
    const filtered: Record<string, any> = {};
    if (updates.title !== undefined) filtered.title = truncate(updates.title, MAX_TITLE_LENGTH);
    if (updates.description !== undefined) filtered.description = truncate(updates.description, MAX_DESCRIPTION_LENGTH);
    if (updates.status !== undefined) filtered.status = updates.status;
    if (updates.priority !== undefined) filtered.priority = updates.priority;

    await ctx.db.patch(taskId, filtered);
  },
});

export const createNote = mutation({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    title: v.string(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    await requireTabOwnership(ctx, args.tabId, args.agentId);

    const existing = await ctx.db
      .query("tabNotes")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    if (existing.length >= MAX_NOTES_PER_TAB) {
      throw new Error(`Note limit reached (${MAX_NOTES_PER_TAB})`);
    }

    return await ctx.db.insert("tabNotes", {
      tabId: args.tabId,
      agentId: args.agentId,
      title: truncate(args.title, MAX_TITLE_LENGTH)!,
      content: truncate(args.content, MAX_NOTE_CONTENT_LENGTH) ?? "",
      updatedAt: Date.now(),
    });
  },
});

export const updateNote = mutation({
  args: {
    serverToken: v.string(),
    noteId: v.id("tabNotes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const tab = await ctx.db.get(note.tabId);
    if (!tab) throw new Error("Tab not found");

    const filtered: Record<string, any> = { updatedAt: Date.now() };
    if (args.title !== undefined) filtered.title = truncate(args.title, MAX_TITLE_LENGTH);
    if (args.content !== undefined) filtered.content = truncate(args.content, MAX_NOTE_CONTENT_LENGTH);

    await ctx.db.patch(args.noteId, filtered);
  },
});

export const addSpreadsheetRow = mutation({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    await requireTabOwnership(ctx, args.tabId, args.agentId);

    // Validate data size
    const serialized = JSON.stringify(args.data);
    if (serialized.length > MAX_CELL_DATA_SIZE) {
      throw new Error(`Row data too large (${serialized.length} chars, max ${MAX_CELL_DATA_SIZE})`);
    }

    const existing = await ctx.db
      .query("tabSpreadsheetRows")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    if (existing.length >= 10000) throw new Error("Row limit reached (10,000)");
    const maxIndex = existing.reduce((max, r) => Math.max(max, r.rowIndex), -1);
    return await ctx.db.insert("tabSpreadsheetRows", {
      tabId: args.tabId,
      agentId: args.agentId,
      rowIndex: maxIndex + 1,
      data: args.data,
    });
  },
});

export const updateSpreadsheetRow = mutation({
  args: {
    serverToken: v.string(),
    rowId: v.id("tabSpreadsheetRows"),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const row = await ctx.db.get(args.rowId);
    if (!row) throw new Error("Row not found");
    const tab = await ctx.db.get(row.tabId);
    if (!tab) throw new Error("Tab not found");

    const serialized = JSON.stringify(args.data);
    if (serialized.length > MAX_CELL_DATA_SIZE) {
      throw new Error(`Row data too large (${serialized.length} chars, max ${MAX_CELL_DATA_SIZE})`);
    }

    await ctx.db.patch(args.rowId, { data: args.data });
  },
});

export const createPage = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    label: v.string(),
    type: v.union(
      v.literal("tasks"),
      v.literal("notes"),
      v.literal("spreadsheet"),
      v.literal("markdown"),
      v.literal("data_table"),
      v.literal("api")
    ),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    const existing = await ctx.db
      .query("sidebarTabs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    // Enforce plan limits (same rules as user-facing sidebarTabs.create)
    const user = await ctx.db.get(agent.userId);
    if (user) {
      const plan = (user.plan ?? "free") as "free" | "pro" | "enterprise";
      const allowedFree = ["tasks", "notes", "markdown", "data_table"];
      const allowedPro = [...allowedFree, "spreadsheet", "postgres", "api"];
      const allowed = plan === "free" ? allowedFree : allowedPro;
      if (!allowed.includes(args.type)) {
        throw new Error(
          `Page type "${args.type}" is not available on the ${plan} plan.`
        );
      }

      const maxPages = plan === "enterprise" ? 50 : plan === "pro" ? 20 : 5;
      if (existing.length >= maxPages) {
        throw new Error(`Page limit reached (${maxPages} for ${plan} plan).`);
      }
    }

    const slug = args.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const maxOrder = existing.reduce(
      (max, t) => Math.max(max, t.sortOrder),
      -1
    );

    return await ctx.db.insert("sidebarTabs", {
      agentId: args.agentId,
      label: args.label.substring(0, 100),
      slug,
      type: args.type,
      sortOrder: maxOrder + 1,
    });
  },
});

export const addSpreadsheetColumn = mutation({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    name: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("date"),
      v.literal("checkbox")
    ),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    await requireTabOwnership(ctx, args.tabId, args.agentId);

    const existing = await ctx.db
      .query("tabSpreadsheetColumns")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    if (existing.length >= 100) throw new Error("Column limit reached (100)");

    const maxOrder = existing.reduce(
      (max, c) => Math.max(max, c.sortOrder),
      -1
    );

    return await ctx.db.insert("tabSpreadsheetColumns", {
      tabId: args.tabId,
      agentId: args.agentId,
      name: args.name.substring(0, 100),
      type: args.type,
      sortOrder: maxOrder + 1,
    });
  },
});

export const updateTabConfig = mutation({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const tab = await ctx.db.get(args.tabId);
    if (!tab) throw new Error("Tab not found");

    const serialized = JSON.stringify(args.config);
    if (serialized.length > MAX_TAB_CONFIG_SIZE) {
      throw new Error(`Config too large (${serialized.length} chars, max ${MAX_TAB_CONFIG_SIZE})`);
    }

    await ctx.db.patch(args.tabId, { config: args.config });
  },
});

// ── API ENDPOINT QUERIES ─────────────────────────────────────────────

export const getApiEndpoint = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    slug: v.string(),
    method: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const endpoints = await ctx.db
      .query("tabApiEndpoints")
      .withIndex("by_agent_slug", (q) =>
        q.eq("agentId", args.agentId).eq("slug", args.slug)
      )
      .collect();
    return endpoints.find(
      (e) => e.method === args.method && e.isActive
    ) ?? null;
  },
});

export const validateApiKey = query({
  args: {
    serverToken: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const keyRecord = await ctx.db
      .query("agentApiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.apiKey))
      .first();
    if (!keyRecord) return null;
    return { agentId: keyRecord.agentId, userId: keyRecord.userId };
  },
});

export const setQuestions = mutation({
  args: {
    serverToken: v.string(),
    messageId: v.id("messages"),
    questions: v.array(
      v.object({
        id: v.string(),
        question: v.string(),
        options: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    await ctx.db.patch(args.messageId, {
      questions: args.questions.slice(0, 6),
    });
  },
});

export const setSuggestions = mutation({
  args: {
    serverToken: v.string(),
    messageId: v.id("messages"),
    suggestions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    await ctx.db.patch(args.messageId, {
      suggestions: args.suggestions.slice(0, 4),
    });
  },
});

export const findTabByLabel = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const tabs = await ctx.db
      .query("sidebarTabs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const tab = tabs.find((t) => t.label === args.label);
    return tab ? tab._id : null;
  },
});

export const createApiEndpoint = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    tabId: v.id("sidebarTabs"),
    name: v.string(),
    method: v.union(
      v.literal("GET"),
      v.literal("POST"),
      v.literal("PUT"),
      v.literal("DELETE"),
      v.literal("PATCH")
    ),
    description: v.optional(v.string()),
    promptTemplate: v.string(),
    responseFormat: v.optional(
      v.union(v.literal("json"), v.literal("text"))
    ),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.agentId !== args.agentId || tab.type !== "api") {
      throw new Error("API tab not found");
    }

    const existing = await ctx.db
      .query("tabApiEndpoints")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    if (existing.length >= 20) {
      throw new Error("Maximum 20 endpoints per API page");
    }

    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const dupes = await ctx.db
      .query("tabApiEndpoints")
      .withIndex("by_agent_slug", (q) =>
        q.eq("agentId", args.agentId).eq("slug", slug)
      )
      .collect();
    if (dupes.length > 0) {
      throw new Error(`Endpoint slug "${slug}" already exists for this agent`);
    }

    return await ctx.db.insert("tabApiEndpoints", {
      tabId: args.tabId,
      agentId: args.agentId,
      name: args.name.substring(0, 100),
      slug,
      method: args.method,
      description: args.description?.substring(0, 500),
      promptTemplate: args.promptTemplate.substring(0, 5000),
      responseFormat: args.responseFormat ?? "json",
      isActive: true,
    });
  },
});

// ── DOCUMENT / RAG ENDPOINTS ──────────────────────────────────────────

export const storeDocumentChunks = mutation({
  args: {
    serverToken: v.string(),
    documentId: v.id("documents"),
    agentId: v.id("agents"),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        content: v.string(),
        embedding: v.array(v.float64()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    for (const chunk of args.chunks) {
      await ctx.db.insert("documentChunks", {
        documentId: args.documentId,
        agentId: args.agentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
      });
    }
  },
});

export const updateDocumentStatus = mutation({
  args: {
    serverToken: v.string(),
    documentId: v.id("documents"),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    chunkCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const patch: Record<string, any> = { status: args.status };
    if (args.chunkCount !== undefined) patch.chunkCount = args.chunkCount;
    if (args.error !== undefined) patch.error = args.error;
    await ctx.db.patch(args.documentId, patch);
  },
});

export const searchDocumentChunks = action({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.AGENT_SERVER_TOKEN;
    if (!expected || args.serverToken !== expected) {
      throw new Error("Invalid server token");
    }

    const searchResults = await ctx.vectorSearch("documentChunks", "by_embedding", {
      vector: args.embedding,
      limit: 8,
      filter: (q) => q.eq("agentId", args.agentId),
    });

    // Join with document names by reading each from the DB
    const enriched: Array<{ content: string; fileName: string; score: number }> = [];
    for (const result of searchResults) {
      const chunk = await ctx.runQuery(internal.documentChunksInternal.getChunkWithDoc, {
        chunkId: result._id,
      });
      if (chunk) {
        enriched.push({
          content: chunk.content,
          fileName: chunk.fileName,
          score: result._score,
        });
      }
    }

    return enriched;
  },
});

export const listAgentDocuments = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db
      .query("documents")
      .withIndex("by_agent_status", (q) =>
        q.eq("agentId", args.agentId).eq("status", "ready")
      )
      .collect();
  },
});

// ── EMAIL ENDPOINTS ──────────────────────────────────────────────────

export const logEmail = mutation({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    to: v.array(v.string()),
    subject: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    return await ctx.db.insert("emailLogs", {
      agentId: args.agentId,
      to: args.to,
      subject: args.subject,
      status: args.status,
      resendId: args.resendId,
      error: args.error,
      sentAt: Date.now(),
    });
  },
});

export const getToolConfig = query({
  args: {
    serverToken: v.string(),
    agentId: v.id("agents"),
    toolSetName: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const configs = await ctx.db
      .query("agentToolConfigs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const match = configs.find((c) => c.toolSetName === args.toolSetName);
    return match?.config ?? null;
  },
});

// ── WEBHOOK ENDPOINTS ────────────────────────────────────────────────

export const validateWebhookSecret = query({
  args: {
    serverToken: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const webhook = await ctx.db
      .query("webhooks")
      .withIndex("by_secret", (q) => q.eq("secret", args.secret))
      .first();
    if (!webhook || !webhook.isActive || webhook.type !== "incoming") {
      return null;
    }
    return {
      webhookId: webhook._id,
      agentId: webhook.agentId,
      tabId: webhook.tabId,
      events: webhook.events,
    };
  },
});

export const listOutgoingWebhooks = query({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
    event: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    return webhooks.filter(
      (w) => w.type === "outgoing" && w.isActive && w.events.includes(args.event)
    );
  },
});

export const createTaskViaWebhook = mutation({
  args: {
    serverToken: v.string(),
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const tab = await ctx.db.get(args.tabId);
    if (!tab || tab.agentId !== args.agentId) {
      throw new Error("Tab not found or does not belong to this agent");
    }

    const existing = await ctx.db
      .query("tabTasks")
      .withIndex("by_tab", (q) => q.eq("tabId", args.tabId))
      .collect();
    if (existing.length >= 500) {
      throw new Error("Task limit reached (500)");
    }

    const maxOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1);

    return await ctx.db.insert("tabTasks", {
      tabId: args.tabId,
      agentId: args.agentId,
      title: args.title.substring(0, 500),
      description: args.description?.substring(0, 5000),
      status: args.status ?? "todo",
      priority: args.priority,
      sortOrder: maxOrder + 1,
    });
  },
});

export const updateTaskViaWebhook = mutation({
  args: {
    serverToken: v.string(),
    taskId: v.id("tabTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const filtered: Record<string, any> = {};
    if (args.title !== undefined) filtered.title = args.title.substring(0, 500);
    if (args.description !== undefined)
      filtered.description = args.description.substring(0, 5000);
    if (args.status !== undefined) filtered.status = args.status;
    if (args.priority !== undefined) filtered.priority = args.priority;

    await ctx.db.patch(args.taskId, filtered);
  },
});

export const updateConversationTitle = mutation({
  args: {
    serverToken: v.string(),
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await requireServerAuth(ctx, args.serverToken);
    await ctx.db.patch(args.conversationId, {
      title: args.title,
    });
  },
});
