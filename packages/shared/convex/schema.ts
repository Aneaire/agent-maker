import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    maxAgents: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  agents: defineTable({
    userId: v.id("users"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.string(),
    model: v.string(),
    enabledToolSets: v.array(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("draft")
    ),
    iconUrl: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_slug", ["slug"]),

  agentToolConfigs: defineTable({
    agentId: v.id("agents"),
    toolSetName: v.string(),
    config: v.any(),
  }).index("by_agent", ["agentId"]),

  customTools: defineTable({
    agentId: v.id("agents"),
    name: v.string(),
    description: v.string(),
    inputSchema: v.any(),
    endpoint: v.string(),
    method: v.union(
      v.literal("GET"),
      v.literal("POST"),
      v.literal("PUT"),
      v.literal("DELETE"),
      v.literal("PATCH")
    ),
    headers: v.optional(v.any()),
  }).index("by_agent", ["agentId"]),

  // ── Sidebar Tabs (Agent Pages) ─────────────────────────────────────

  sidebarTabs: defineTable({
    agentId: v.id("agents"),
    label: v.string(),
    slug: v.string(),
    icon: v.optional(v.string()),
    type: v.union(
      v.literal("tasks"),
      v.literal("notes"),
      v.literal("spreadsheet"),
      v.literal("markdown"),
      v.literal("data_table"),
      v.literal("postgres"),
      v.literal("api")
    ),
    config: v.optional(v.any()),
    sortOrder: v.number(),
  }).index("by_agent", ["agentId"]),

  // ── Tasks (backing table for "tasks" tabs) ─────────────────────────

  tabTasks: defineTable({
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    sortOrder: v.number(),
  })
    .index("by_tab", ["tabId"])
    .index("by_agent", ["agentId"])
    .index("by_tab_status", ["tabId", "status"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["tabId"],
    }),

  // ── Notes (backing table for "notes" tabs) ─────────────────────────

  tabNotes: defineTable({
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    title: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_tab", ["tabId"])
    .index("by_agent", ["agentId"])
    .searchIndex("search_notes", {
      searchField: "content",
      filterFields: ["tabId"],
    }),

  // ── Spreadsheet (backing tables for "spreadsheet" tabs) ────────────

  tabSpreadsheetColumns: defineTable({
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    name: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("number"),
      v.literal("date"),
      v.literal("checkbox")
    ),
    sortOrder: v.number(),
  }).index("by_tab", ["tabId"]),

  tabSpreadsheetRows: defineTable({
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    rowIndex: v.number(),
    data: v.any(), // JSON object: { columnName: value }
  })
    .index("by_tab", ["tabId"])
    .index("by_tab_row", ["tabId", "rowIndex"]),

  // ── PostgreSQL Connections (premium add-on) ────────────────────────

  agentDatabases: defineTable({
    agentId: v.id("agents"),
    tabId: v.id("sidebarTabs"),
    displayName: v.string(),
    connectionString: v.string(), // encrypted at rest
    status: v.union(
      v.literal("connected"),
      v.literal("disconnected"),
      v.literal("error")
    ),
    lastTestedAt: v.optional(v.number()),
  })
    .index("by_agent", ["agentId"])
    .index("by_tab", ["tabId"]),

  // ── API Endpoints (backing table for "api" tabs) ────────────────────

  tabApiEndpoints: defineTable({
    tabId: v.id("sidebarTabs"),
    agentId: v.id("agents"),
    name: v.string(),
    slug: v.string(),
    method: v.union(
      v.literal("GET"),
      v.literal("POST"),
      v.literal("PUT"),
      v.literal("DELETE"),
      v.literal("PATCH")
    ),
    description: v.optional(v.string()),
    promptTemplate: v.string(), // Instruction for the agent on how to handle this endpoint
    responseFormat: v.union(v.literal("json"), v.literal("text")),
    isActive: v.boolean(),
  })
    .index("by_tab", ["tabId"])
    .index("by_agent", ["agentId"])
    .index("by_agent_slug", ["agentId", "slug"]),

  // API keys for authenticating external calls
  agentApiKeys: defineTable({
    agentId: v.id("agents"),
    userId: v.id("users"),
    key: v.string(),
    label: v.string(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_key", ["key"]),

  // ── Core Tables ────────────────────────────────────────────────────

  conversations: defineTable({
    agentId: v.id("agents"),
    userId: v.id("users"),
    title: v.optional(v.string()),
  })
    .index("by_agent", ["agentId"])
    .index("by_user", ["userId"])
    .index("by_agent_and_user", ["agentId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
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
          input: v.any(),
          output: v.optional(v.string()),
        })
      )
    ),
    error: v.optional(v.string()),
    suggestions: v.optional(v.array(v.string())),
    questions: v.optional(
      v.array(
        v.object({
          id: v.string(),
          question: v.string(),
          options: v.array(v.string()),
        })
      )
    ),
  }).index("by_conversation", ["conversationId"]),

  memories: defineTable({
    agentId: v.id("agents"),
    content: v.string(),
    category: v.optional(v.string()),
  })
    .index("by_agent", ["agentId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["agentId"],
    }),

  agentJobs: defineTable({
    agentId: v.id("agents"),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    workerId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_agent", ["agentId"])
    .index("by_user_status", ["userId", "status"]),

  creatorSessions: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    partialConfig: v.optional(v.any()),
    agentId: v.optional(v.id("agents")),
    conversationId: v.optional(v.id("conversations")),
  })
    .index("by_user", ["userId"])
    .index("by_agent", ["agentId"]),
});
