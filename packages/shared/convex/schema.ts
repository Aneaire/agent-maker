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
    imageGenModel: v.optional(v.string()),
    enabledToolSets: v.array(v.string()),
    enabledModels: v.optional(v.array(v.string())),
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
      v.literal("api"),
      v.literal("workflow")
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
    status: v.string(),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    tags: v.optional(v.array(v.string())),
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
    tags: v.optional(v.array(v.string())),
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
          progress: v.optional(v.string()),
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
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_status", ["conversationId", "status"]),

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

  documents: defineTable({
    agentId: v.id("agents"),
    fileName: v.string(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    chunkCount: v.optional(v.number()),
    error: v.optional(v.string()),
    uploadedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_status", ["agentId", "status"]),

  documentChunks: defineTable({
    documentId: v.id("documents"),
    agentId: v.id("agents"),
    chunkIndex: v.number(),
    content: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_document", ["documentId"])
    .index("by_agent", ["agentId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 3072,
      filterFields: ["agentId"],
    }),

  webhooks: defineTable({
    agentId: v.id("agents"),
    tabId: v.id("sidebarTabs"),
    type: v.union(v.literal("incoming"), v.literal("outgoing")),
    secret: v.string(),
    url: v.optional(v.string()),
    events: v.array(v.string()),
    isActive: v.boolean(),
    label: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_tab", ["tabId"])
    .index("by_secret", ["secret"]),

  emailLogs: defineTable({
    agentId: v.id("agents"),
    to: v.array(v.string()),
    subject: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_status", ["agentId", "status"]),

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

  // ── Scheduled Actions (Cron) ──────────────────────────────────────

  scheduledActions: defineTable({
    agentId: v.id("agents"),
    name: v.string(),
    description: v.optional(v.string()),
    // Cron expression (e.g. "0 9 * * 1" = every Monday 9am) or interval ("every 5m", "every 1h")
    schedule: v.string(),
    scheduleType: v.union(v.literal("cron"), v.literal("interval"), v.literal("once")),
    // What the agent should do when triggered
    action: v.object({
      type: v.union(
        v.literal("send_message"),    // Send a message to a conversation
        v.literal("run_prompt"),      // Run a prompt (creates new conversation)
        v.literal("fire_webhook"),    // Fire an outgoing webhook
        v.literal("send_email"),      // Send an email
        v.literal("create_task"),     // Create a task
        v.literal("run_automation"),  // Trigger an automation chain
      ),
      config: v.any(), // Action-specific config (prompt, webhook URL, email params, etc.)
    }),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),  // For one-time schedules
      v.literal("error")
    ),
    timezone: v.optional(v.string()),  // e.g. "America/New_York"
    nextRunAt: v.optional(v.number()), // Unix timestamp of next execution
    lastRunAt: v.optional(v.number()),
    runCount: v.number(),
    maxRuns: v.optional(v.number()),   // Stop after N runs (null = unlimited)
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_status", ["status"])
    .index("by_next_run", ["status", "nextRunAt"]),

  scheduledActionRuns: defineTable({
    actionId: v.id("scheduledActions"),
    agentId: v.id("agents"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  })
    .index("by_action", ["actionId"])
    .index("by_agent", ["agentId"]),

  // ── Automation Runs (execution history for automations) ─────────────

  automationRuns: defineTable({
    automationId: v.id("automations"),
    agentId: v.id("agents"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    triggerEvent: v.string(),
    triggerPayload: v.optional(v.any()),
    actionsExecuted: v.optional(v.array(v.object({
      type: v.string(),
      status: v.union(v.literal("completed"), v.literal("failed"), v.literal("skipped")),
      result: v.optional(v.string()),
      error: v.optional(v.string()),
      duration: v.optional(v.number()),
    }))),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  })
    .index("by_automation", ["automationId"])
    .index("by_agent", ["agentId"])
    .index("by_agent_started", ["agentId", "startedAt"]),

  // ── Event Bus ───────────────────────────────────────────────────────

  agentEvents: defineTable({
    agentId: v.id("agents"),
    event: v.string(),  // e.g. "task.created", "email.sent", "schedule.fired", "webhook.received"
    source: v.string(),  // e.g. "page_tools", "email_tools", "webhook", "schedule", "automation"
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_event", ["agentId", "event"])
    .index("by_created", ["createdAt"]),

  // ── Automations (Event → Action rules) ──────────────────────────────

  automations: defineTable({
    agentId: v.id("agents"),
    name: v.string(),
    description: v.optional(v.string()),
    // Trigger: which event activates this
    trigger: v.object({
      event: v.string(),  // e.g. "task.created", "email.sent", "webhook.received", "schedule.fired"
      filter: v.optional(v.any()),  // Optional conditions (e.g. { status: "done" })
    }),
    // Actions to perform (executed in order)
    actions: v.array(v.object({
      type: v.union(
        v.literal("send_email"),
        v.literal("create_task"),
        v.literal("update_task"),
        v.literal("create_note"),
        v.literal("fire_webhook"),
        v.literal("store_memory"),
        v.literal("run_prompt"),       // Have the agent process something
        v.literal("trigger_agent"),    // Trigger another agent
        v.literal("delay"),            // Wait before next action
      ),
      config: v.any(),  // Action-specific configuration with template variables
    })),
    isActive: v.boolean(),
    runCount: v.number(),
    lastRunAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"]),

  // ── Inter-Agent Messages ────────────────────────────────────────────

  agentMessages: defineTable({
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    content: v.string(),
    context: v.optional(v.any()),  // Structured data passed between agents
    status: v.union(
      v.literal("pending"),
      v.literal("delivered"),
      v.literal("processed"),
      v.literal("failed")
    ),
    response: v.optional(v.string()),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_to_agent", ["toAgentId", "status"])
    .index("by_from_agent", ["fromAgentId"]),

  // ── Timers / Delayed Actions ────────────────────────────────────────

  agentTimers: defineTable({
    agentId: v.id("agents"),
    conversationId: v.optional(v.id("conversations")),
    label: v.string(),
    fireAt: v.number(),  // Unix timestamp
    action: v.object({
      type: v.union(
        v.literal("send_message"),
        v.literal("send_email"),
        v.literal("create_task"),
        v.literal("fire_webhook"),
        v.literal("run_prompt"),
      ),
      config: v.any(),
    }),
    status: v.union(v.literal("waiting"), v.literal("fired"), v.literal("cancelled")),
    createdAt: v.number(),
    firedAt: v.optional(v.number()),
  })
    .index("by_agent", ["agentId"])
    .index("by_status_fire", ["status", "fireAt"]),

  // ── Asset Folders ──────────────────────────────────────────────────

  assetFolders: defineTable({
    agentId: v.id("agents"),
    name: v.string(),
    parentId: v.optional(v.id("assetFolders")),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_parent", ["agentId", "parentId"]),

  // ── Assets (generated images, uploaded files) ─────────────────────

  assets: defineTable({
    agentId: v.id("agents"),
    folderId: v.optional(v.id("assetFolders")),
    name: v.string(),
    type: v.union(v.literal("image"), v.literal("file")),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),  // External URL (e.g. from generation API)
    mimeType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    // Generation metadata
    generatedBy: v.optional(v.union(
      v.literal("gemini"),
      v.literal("nano_banana"),
    )),
    prompt: v.optional(v.string()),
    model: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_folder", ["agentId", "folderId"])
    .index("by_agent_type", ["agentId", "type"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["agentId"],
    }),

  // ── Credential Management ────────────────────────────────────────────

  credentials: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.string(),
    encryptedData: v.string(),
    iv: v.string(),
    status: v.union(v.literal("valid"), v.literal("untested"), v.literal("invalid")),
    lastTestedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"]),

  agentCredentialLinks: defineTable({
    agentId: v.id("agents"),
    toolSetName: v.string(),
    credentialId: v.id("credentials"),
  })
    .index("by_agent", ["agentId"])
    .index("by_credential", ["credentialId"])
    .index("by_agent_toolset", ["agentId", "toolSetName"]),

  oauthStates: defineTable({
    userId: v.id("users"),
    state: v.string(),
    provider: v.string(),
    scopes: v.array(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_state", ["state"]),

  creatorSessions: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    mode: v.optional(v.union(v.literal("create"), v.literal("edit"))),
    partialConfig: v.optional(v.any()),
    agentId: v.optional(v.id("agents")),
    conversationId: v.optional(v.id("conversations")),
  })
    .index("by_user", ["userId"])
    .index("by_agent", ["agentId"]),
});
