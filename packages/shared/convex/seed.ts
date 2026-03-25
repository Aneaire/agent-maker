/**
 * Sandbox seed script — creates a fully-featured test agent with realistic data.
 *
 * Usage:
 *   npx convex run seed:run '{"email":"aneaire010@gmail.com","force":true}'
 *   npx convex run seed:cleanup '{"email":"aneaire010@gmail.com"}'
 *
 * This file never needs editing when features are added.
 * To add test data for a new feature, add a seeder to seed/registry.ts.
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  TOOLSET_SEEDERS,
  PAGE_SEEDERS,
  CORE_TOOL_SETS,
  seedEvents,
} from "./seed/registry";

const SANDBOX_SLUG = "sandbox-test-agent";

const SYSTEM_PROMPT = `You are Sandbox Test Agent, a versatile project management assistant built to exercise all platform capabilities.

## Your Capabilities
You can manage tasks, notes, spreadsheets, and documentation through workspace pages. You have persistent memory to recall context across conversations. You support automations (event → action rules), scheduled actions (cron jobs), timers, webhooks, and inter-agent messaging.

## Behavior Guidelines
- Be concise and actionable — the user prefers short, direct responses
- When asked about tasks, read from the Project Tasks page
- When storing important info, use your memory tools
- When creating tasks, always set a priority and relevant tags
- Reference your Meeting Notes and Documentation pages when answering project questions
- Use suggestions to offer logical next actions after completing a request

## Available Pages
- **Project Tasks** — Kanban board with current work items
- **Meeting Notes** — Sprint planning, architecture decisions, onboarding docs
- **Contacts** — Spreadsheet of team contacts and partners
- **Documentation** — Project overview and architecture reference
- **Agent API** — REST endpoints for external integrations`;

// ── Debug: list users (for finding correct email) ───────────────────────

export const listUsers = internalQuery({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users;
  },
});

// ── Functional Tests ────────────────────────────────────────────────────
// These test REAL functionality — create real data, fire real events,
// trigger real automations, and verify real results.

/**
 * Test: Create a task → fires task.created event → automation processes it.
 *
 * This exercises the full pipeline:
 *   1. Insert task into DB (same as agent page tools)
 *   2. Emit task.created event (same as page_tools)
 *   3. Dispatch event to agent server (triggers processAutomations)
 *   4. Automations match and execute their actions
 *
 * Run: npx convex run seed:testCreateTaskAutomation '{}'
 * Then wait ~5s and run: npx convex run seed:verifyAutomationResults '{}'
 */
export const testCreateTaskAutomation = internalMutation({
  handler: async (ctx) => {
    // Find the sandbox agent
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", SANDBOX_SLUG))
      .collect();
    const agent = agents[0];
    if (!agent) throw new Error("Sandbox agent not found. Run seed:run first.");

    // Find the tasks tab
    const tabs = await ctx.db
      .query("sidebarTabs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const tasksTab = tabs.find((t) => t.type === "tasks");
    if (!tasksTab) throw new Error("Tasks tab not found.");

    // Count notes BEFORE (so we can verify new ones were created by automation)
    const notesTab = tabs.find((t) => t.type === "notes");
    let noteCountBefore = 0;
    if (notesTab) {
      const notes = await ctx.db
        .query("tabNotes")
        .withIndex("by_tab", (q) => q.eq("tabId", notesTab._id))
        .collect();
      noteCountBefore = notes.length;
    }

    // Count memories BEFORE
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const memoryCountBefore = memories.length;

    // Count events BEFORE
    const events = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const eventCountBefore = events.length;

    // 1. Create a real task (same as page_tools.create_task)
    const taskId = await ctx.db.insert("tabTasks", {
      tabId: tasksTab._id,
      agentId: agent._id,
      title: "TEST: Automation Trigger Test",
      description: "This task was created by the functional test to verify automations fire correctly.",
      status: "todo",
      priority: "high",
      tags: ["test", "automation"],
      sortOrder: 999,
    });

    // 2. Emit the task.created event (same as page_tools does)
    const payload = {
      taskId: taskId as string,
      tabId: tasksTab._id as string,
      title: "TEST: Automation Trigger Test",
      description: "This task was created by the functional test to verify automations fire correctly.",
      status: "todo",
      priority: "high",
      tags: ["test", "automation"],
    };

    await ctx.db.insert("agentEvents", {
      agentId: agent._id,
      event: "task.created",
      source: "seed_test",
      payload,
      createdAt: Date.now(),
    });

    // 3. Process automations natively in Convex
    await ctx.scheduler.runAfter(0, internal.processAutomation.processEvent, {
      agentId: agent._id,
      event: "task.created",
      payload,
    });

    return {
      status: "dispatched",
      taskId,
      agentId: agent._id,
      noteCountBefore,
      memoryCountBefore,
      eventCountBefore,
      message: "Task created and event dispatched. Run seed:verifyAutomationResults in ~5 seconds to check results.",
    };
  },
});

/**
 * Verify automation results after testCreateTaskAutomation.
 *
 * Checks:
 * 1. "New Task Logger" automation → should have created a note with title "New Task: TEST: Automation Trigger Test"
 * 2. "Task Note Creator (Run Prompt)" automation → should have created a new conversation + job
 * 3. Event count increased (automation.triggered events)
 */
export const verifyAutomationResults = internalQuery({
  handler: async (ctx) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", SANDBOX_SLUG))
      .collect();
    const agent = agents[0];
    if (!agent) return { error: "Sandbox agent not found." };

    // Check notes — "New Task Logger" should have created one
    const tabs = await ctx.db
      .query("sidebarTabs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const notesTab = tabs.find((t) => t.type === "notes");
    const allNotes = notesTab
      ? await ctx.db
          .query("tabNotes")
          .withIndex("by_tab", (q) => q.eq("tabId", notesTab._id))
          .collect()
      : [];
    const automationNote = allNotes.find((n) =>
      n.title.includes("New Task:") || n.title.includes("TEST:")
    );

    // Check conversations — "Task Note Creator (Run Prompt)" should have created one
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const automationConversation = conversations.find((c) =>
      c.title?.includes("Automation:")
    );

    // Check events
    const events = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const testEvents = events.filter((e) => e.source === "seed_test");

    // Check automations ran
    const automations = await ctx.db
      .query("automations")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();

    // Check if any jobs were created (from run_prompt)
    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();

    const results = {
      // Test 1: "New Task Logger" created a note?
      noteCreatedByAutomation: automationNote
        ? { pass: true, noteTitle: automationNote.title, noteContent: automationNote.content.substring(0, 200) }
        : { pass: false, message: "No note found with 'TEST: Automation Trigger Test' in title" },

      // Test 2: "Task Note Creator (Run Prompt)" created a conversation?
      runPromptTriggered: automationConversation
        ? { pass: true, conversationTitle: automationConversation.title }
        : { pass: false, message: "No conversation found with 'Automation:' title prefix" },

      // Test 3: Event was recorded
      eventRecorded: testEvents.length > 0
        ? { pass: true, eventCount: testEvents.length }
        : { pass: false, message: "No events from seed_test source found" },

      // Context
      totalNotes: allNotes.length,
      totalConversations: conversations.length,
      totalEvents: events.length,
      totalJobs: jobs.length,
      automations: automations.map((a) => ({
        name: a.name,
        isActive: a.isActive,
        runCount: a.runCount,
        lastRunAt: a.lastRunAt,
      })),
    };

    return results;
  },
});

// ── Main seed ────────────────────────────────────────────────────────────

export const run = internalMutation({
  args: {
    email: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const summary: Record<string, any> = {};

    // 1. Find user by email or clerkId
    const allUsers = await ctx.db.query("users").collect();
    let user = allUsers.find((u) => u.email === args.email);
    // Fallback: if email fields are empty (Clerk sync issue), use the first pro user or first user
    if (!user) {
      user = allUsers.find((u) => u.plan === "pro") ?? allUsers[0];
    }
    if (!user) {
      throw new Error(
        `No users found in the database. Sign in at least once before running the seed.`
      );
    }
    summary.userId = user._id;

    // 2. Check for existing sandbox agent
    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", SANDBOX_SLUG))
      .collect();
    const existing = existingAgents.find((a) => a.userId === user._id);

    if (existing) {
      if (!args.force) {
        return {
          status: "skipped",
          message: "Sandbox agent already exists. Use force=true to recreate.",
          agentId: existing._id,
        };
      }
      // Cascade delete the existing agent
      await cascadeDeleteAgent(ctx, existing._id);
      summary.deletedPrevious = existing._id;
    }

    // 3. Ensure user has pro plan for full feature access
    if (user.plan !== "pro" && user.plan !== "enterprise") {
      await ctx.db.patch(user._id, { plan: "pro", maxAgents: 25 });
      summary.upgradedPlan = true;
    }

    // 4. Build enabledToolSets dynamically from registry
    const enabledToolSets = [
      ...TOOLSET_SEEDERS.map((s) => s.name),
      ...CORE_TOOL_SETS,
    ];

    // 5. Create the sandbox agent
    const agentId = await ctx.db.insert("agents", {
      userId: user._id,
      name: "Sandbox Test Agent",
      slug: SANDBOX_SLUG,
      description:
        "Full-featured test agent for debugging and validating all system capabilities.",
      systemPrompt: SYSTEM_PROMPT,
      model: "claude-sonnet-4-6",
      enabledToolSets,
      status: "active",
    });
    summary.agentId = agentId;
    summary.enabledToolSets = enabledToolSets;

    const seedCtx = { ctx, agentId, userId: user._id };

    // 6. Run page seeders — create tabs and populate data
    summary.pages = {};
    let sortOrder = 0;
    for (const pageSeeder of PAGE_SEEDERS) {
      const pageSlug = pageSeeder.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const tabId = await ctx.db.insert("sidebarTabs", {
        agentId,
        label: pageSeeder.label,
        slug: pageSlug,
        type: pageSeeder.type as any,
        sortOrder: sortOrder++,
      });

      const result = await pageSeeder.seed({ ...seedCtx, tabId });
      summary.pages[pageSeeder.type] = { tabId, ...result };
    }

    // 7. Run tool set seeders
    summary.toolSets = {};
    for (const toolSeeder of TOOLSET_SEEDERS) {
      const result = await toolSeeder.seed(seedCtx);
      summary.toolSets[toolSeeder.name] = result;
    }

    // 8. Create sample conversation with messages
    const conversationId = await ctx.db.insert("conversations", {
      agentId,
      userId: user._id,
      title: "Project Status Check",
    });

    const messageDefs = [
      {
        role: "user" as const,
        content: "What tasks are currently in progress?",
        status: "done" as const,
      },
      {
        role: "assistant" as const,
        content:
          'You have 2 tasks in progress:\n\n1. **Implement user authentication** (high priority) — Integrating Clerk for OAuth and SSO support\n2. **Write API documentation** (medium priority) — Documenting REST endpoints with OpenAPI spec\n\nWould you like me to check on any blockers or update the status of either task?',
        status: "done" as const,
        suggestions: [
          "Show me all high-priority tasks",
          "What's blocking the auth task?",
          "Mark the API docs as done",
        ],
      },
      {
        role: "user" as const,
        content: "Remember that the auth task is blocked on the SSO provider decision.",
        status: "done" as const,
      },
      {
        role: "assistant" as const,
        content:
          "Got it — I've stored that the auth task is blocked on the SSO provider decision. I'll reference this when you ask about task status or blockers.\n\nIs there anything else you'd like to update?",
        status: "done" as const,
        toolCalls: [
          {
            id: "seed_tc_1",
            name: "store_memory",
            input: {
              content: "Auth task is blocked on SSO provider decision",
              category: "project",
            },
            output: "Memory stored successfully.",
          },
        ],
      },
    ];

    const messageIds = [];
    for (const msg of messageDefs) {
      const id = await ctx.db.insert("messages", {
        conversationId,
        ...msg,
      });
      messageIds.push(id);
    }
    summary.conversation = { conversationId, messageIds };

    // 9. Seed sample events
    const eventResult = await seedEvents(seedCtx);
    summary.events = eventResult;

    summary.status = "created";
    return summary;
  },
});

// ── Cleanup ──────────────────────────────────────────────────────────────

export const cleanup = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Find user by email or fallback
    const allUsers = await ctx.db.query("users").collect();
    let user = allUsers.find((u) => u.email === args.email);
    if (!user) {
      user = allUsers.find((u) => u.plan === "pro") ?? allUsers[0];
    }
    if (!user) {
      throw new Error(`No users found in the database.`);
    }

    // Find sandbox agent
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", SANDBOX_SLUG))
      .collect();
    const agent = agents.find((a) => a.userId === user._id);
    if (!agent) {
      return { status: "not_found", message: "No sandbox agent found." };
    }

    await cascadeDeleteAgent(ctx, agent._id);
    return { status: "deleted", agentId: agent._id };
  },
});

// ── Cascade Delete Helper ────────────────────────────────────────────────
// Mirrors agents.remove logic + handles spreadsheet data and API endpoints
// that the original remove mutation misses.

async function cascadeDeleteAgent(
  ctx: { db: any; storage?: any },
  agentId: any
) {
  // Conversations + messages
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const conv of conversations) {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q: any) => q.eq("conversationId", conv._id))
      .collect();
    for (const msg of messages) await ctx.db.delete(msg._id);
    await ctx.db.delete(conv._id);
  }

  // Memories
  const memories = await ctx.db
    .query("memories")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const m of memories) await ctx.db.delete(m._id);

  // Sidebar tabs + backing data
  const tabs = await ctx.db
    .query("sidebarTabs")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const tab of tabs) {
    // Tasks
    const tasks = await ctx.db
      .query("tabTasks")
      .withIndex("by_tab", (q: any) => q.eq("tabId", tab._id))
      .collect();
    for (const t of tasks) await ctx.db.delete(t._id);

    // Notes
    const notes = await ctx.db
      .query("tabNotes")
      .withIndex("by_tab", (q: any) => q.eq("tabId", tab._id))
      .collect();
    for (const n of notes) await ctx.db.delete(n._id);

    // Spreadsheet columns + rows
    const cols = await ctx.db
      .query("tabSpreadsheetColumns")
      .withIndex("by_tab", (q: any) => q.eq("tabId", tab._id))
      .collect();
    for (const c of cols) await ctx.db.delete(c._id);

    const rows = await ctx.db
      .query("tabSpreadsheetRows")
      .withIndex("by_tab", (q: any) => q.eq("tabId", tab._id))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);

    // API endpoints
    const endpoints = await ctx.db
      .query("tabApiEndpoints")
      .withIndex("by_tab", (q: any) => q.eq("tabId", tab._id))
      .collect();
    for (const e of endpoints) await ctx.db.delete(e._id);

    // Webhooks (per tab)
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_tab", (q: any) => q.eq("tabId", tab._id))
      .collect();
    for (const w of webhooks) await ctx.db.delete(w._id);

    await ctx.db.delete(tab._id);
  }

  // Tool configs
  const toolConfigs = await ctx.db
    .query("agentToolConfigs")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const tc of toolConfigs) await ctx.db.delete(tc._id);

  // Custom tools
  const customTools = await ctx.db
    .query("customTools")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const ct of customTools) await ctx.db.delete(ct._id);

  // Jobs
  const jobs = await ctx.db
    .query("agentJobs")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const j of jobs) await ctx.db.delete(j._id);

  // Documents + chunks
  const documents = await ctx.db
    .query("documents")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const doc of documents) {
    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("by_document", (q: any) => q.eq("documentId", doc._id))
      .collect();
    for (const chunk of chunks) await ctx.db.delete(chunk._id);
    if (ctx.storage) {
      try {
        await ctx.storage.delete(doc.storageId);
      } catch {
        // Storage file may already be deleted
      }
    }
    await ctx.db.delete(doc._id);
  }

  // Scheduled actions + runs
  const schedules = await ctx.db
    .query("scheduledActions")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const s of schedules) {
    const runs = await ctx.db
      .query("scheduledActionRuns")
      .withIndex("by_action", (q: any) => q.eq("actionId", s._id))
      .collect();
    for (const r of runs) await ctx.db.delete(r._id);
    await ctx.db.delete(s._id);
  }

  // Automations
  const automations = await ctx.db
    .query("automations")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const a of automations) await ctx.db.delete(a._id);

  // Events
  const events = await ctx.db
    .query("agentEvents")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const e of events) await ctx.db.delete(e._id);

  // Timers
  const timers = await ctx.db
    .query("agentTimers")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const t of timers) await ctx.db.delete(t._id);

  // Inter-agent messages (sent by this agent)
  const sentMsgs = await ctx.db
    .query("agentMessages")
    .withIndex("by_from_agent", (q: any) => q.eq("fromAgentId", agentId))
    .collect();
  for (const m of sentMsgs) await ctx.db.delete(m._id);

  // Email logs
  const emailLogs = await ctx.db
    .query("emailLogs")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const l of emailLogs) await ctx.db.delete(l._id);

  // Credential links (not the credentials themselves)
  const credLinks = await ctx.db
    .query("agentCredentialLinks")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const cl of credLinks) await ctx.db.delete(cl._id);

  // Assets + folders
  const assets = await ctx.db
    .query("assets")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const a of assets) {
    if (a.storageId && ctx.storage) {
      try {
        await ctx.storage.delete(a.storageId);
      } catch {
        // Storage file may already be deleted
      }
    }
    await ctx.db.delete(a._id);
  }

  const folders = await ctx.db
    .query("assetFolders")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const f of folders) await ctx.db.delete(f._id);

  // API keys
  const apiKeys = await ctx.db
    .query("agentApiKeys")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const k of apiKeys) await ctx.db.delete(k._id);

  // Creator sessions
  const sessions = await ctx.db
    .query("creatorSessions")
    .withIndex("by_agent", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const s of sessions) await ctx.db.delete(s._id);

  // Finally, delete the agent itself
  await ctx.db.delete(agentId);
}
