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

// ── Discord Bot — enable/configure for sandbox agent ────────────────────

export const configureDiscordBot = internalMutation({
  args: {
    enabled: v.boolean(),
    botPrompt: v.optional(v.string()),
    botModel: v.optional(v.string()),
    authorizedUsers: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const agent = await getSandboxAgent(ctx);
    const patch: any = { discordBotEnabled: args.enabled };
    if (args.botPrompt !== undefined) patch.discordBotPrompt = args.botPrompt;
    if (args.botModel !== undefined) patch.discordBotModel = args.botModel;
    if (args.authorizedUsers !== undefined) patch.discordAuthorizedUsers = args.authorizedUsers;
    await ctx.db.patch(agent._id, patch);
    return { agentId: agent._id, ...patch };
  },
});

export const resetDiscordConversations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const mappings = await ctx.db
      .query("discordConversationMap")
      .withIndex("by_agent_channel", (q: any) => q.eq("agentId", agent._id))
      .collect();
    for (const m of mappings) {
      await ctx.db.delete(m._id);
    }
    return { deleted: mappings.length };
  },
});

// ── Debug: list users (for finding correct email) ───────────────────────

export const listUsers = internalQuery({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users;
  },
});

// ── Debug: inspect sandbox agent config ─────────────────────────────────

export const debugSandboxAgent = internalQuery({
  handler: async (ctx) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", SANDBOX_SLUG))
      .collect();
    const agent = agents[0];
    if (!agent) return { error: "Sandbox agent not found. Run seed:run first." };

    const credLinks = await ctx.db
      .query("agentCredentialLinks")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agent._id))
      .collect();

    const creds = await Promise.all(
      credLinks.map(async (link: any) => {
        const cred = await ctx.db.get(link.credentialId);
        return { toolSetName: link.toolSetName, type: (cred as any)?.type, name: (cred as any)?.name, linkId: link._id };
      })
    );

    return {
      agentId: agent._id,
      name: agent.name,
      enabledToolSets: agent.enabledToolSets,
      linkedCredentials: creds,
      discordBotEnabled: (agent as any).discordBotEnabled ?? false,
      discordBotPrompt: (agent as any).discordBotPrompt ?? null,
      discordBotModel: (agent as any).discordBotModel ?? null,
      discordAuthorizedUsers: (agent as any).discordAuthorizedUsers ?? [],
    };
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

/**
 * Test scheduled action execution.
 * Creates a "once" schedule with run_prompt, verifies it fires.
 */
export const testSchedule = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db.query("users").collect();
    let user = allUsers.find((u) => u.email === args.email);
    if (!user) user = allUsers.find((u) => u.plan === "pro") ?? allUsers[0];
    if (!user) throw new Error("No users found");

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", SANDBOX_SLUG))
      .collect();
    const agent = agents.find((a) => a.userId === user!._id);
    if (!agent) throw new Error("Sandbox agent not found. Run seed:run first.");

    // Count schedules, runs, and events BEFORE
    const schedulesBefore = await ctx.db
      .query("scheduledActions")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const runsBefore = await ctx.db
      .query("scheduledActionRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const eventsBefore = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const conversationsBefore = await ctx.db
      .query("conversations")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();

    // Create a "once" schedule with run_prompt that fires immediately
    const now = Date.now();
    const actionId = await ctx.db.insert("scheduledActions", {
      agentId: agent._id,
      name: "TEST: Immediate Prompt Schedule",
      description: "Created by testSchedule to verify schedule execution works",
      schedule: "",
      scheduleType: "once",
      action: {
        type: "run_prompt",
        config: {
          prompt: "This is a test prompt from the schedule system. Please confirm you received this by saying 'Schedule test received'.",
        },
      },
      status: "active",
      nextRunAt: now,
      runCount: 0,
      createdAt: now,
    });

    // Fire it via the Convex-native schedule executor
    await ctx.scheduler.runAfter(0, internal.processAutomation.fireSchedule, {
      actionId,
    });

    return {
      status: "dispatched",
      actionId,
      agentId: agent._id,
      before: {
        schedules: schedulesBefore.length,
        runs: runsBefore.length,
        events: eventsBefore.length,
        conversations: conversationsBefore.length,
      },
      message: "Schedule created and dispatched. Run seed:verifyScheduleResults in ~5 seconds to check.",
    };
  },
});

/**
 * Verify schedule test results.
 */
export const verifyScheduleResults = internalQuery({
  args: {
    schedulesCountBefore: v.optional(v.number()),
    runsCountBefore: v.optional(v.number()),
    eventsCountBefore: v.optional(v.number()),
    conversationsCountBefore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", SANDBOX_SLUG))
      .collect();
    const agent = agents[0];
    if (!agent) return { error: "Sandbox agent not found." };

    // Check schedule was marked completed
    const schedules = await ctx.db
      .query("scheduledActions")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const testSchedule = schedules.find((s) => s.name === "TEST: Immediate Prompt Schedule");

    // Check run record was created
    const runs = await ctx.db
      .query("scheduledActionRuns")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();

    // Check schedule.fired event was emitted
    const events = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const scheduleFiredEvents = events.filter((e) => e.event === "schedule.fired");

    // Check conversation was created by run_prompt
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();
    const scheduleConvo = conversations.find((c) =>
      c.title?.includes("Schedule: TEST: Immediate Prompt Schedule")
    );

    // Check job was created
    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();

    return {
      scheduleCompleted: testSchedule
        ? {
            pass: testSchedule.status === "completed",
            status: testSchedule.status,
            runCount: testSchedule.runCount,
            lastRunAt: testSchedule.lastRunAt,
          }
        : { pass: false, message: "Test schedule not found" },

      runRecordCreated: {
        pass: runs.length > (args.runsCountBefore ?? 0),
        totalRuns: runs.length,
        latestRun: runs.length > 0
          ? { status: runs[runs.length - 1].status, result: runs[runs.length - 1].result }
          : null,
      },

      eventEmitted: {
        pass: scheduleFiredEvents.length > 0,
        scheduleFiredCount: scheduleFiredEvents.length,
        latestEvent: scheduleFiredEvents.length > 0
          ? scheduleFiredEvents[scheduleFiredEvents.length - 1].payload
          : null,
      },

      conversationCreated: scheduleConvo
        ? { pass: true, title: scheduleConvo.title }
        : { pass: false, message: "No conversation with 'Schedule:' prefix found" },

      jobCreated: {
        pass: jobs.length > 0,
        totalJobs: jobs.length,
      },

      totals: {
        schedules: schedules.length,
        runs: runs.length,
        events: events.length,
        conversations: conversations.length,
      },
    };
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

// ── Live Tool Tests ─────────────────────────────────────────────────────
// These dispatch real jobs to the agent server so it exercises live tools
// (Gmail, Google Sheets, etc.) using connected credentials.

async function dispatchAgentPrompt(
  ctx: any,
  agentId: any,
  userId: any,
  prompt: string,
  title: string
) {
  const conversationId = await ctx.db.insert("conversations", {
    agentId,
    userId,
    title,
  });
  await ctx.db.insert("messages", {
    conversationId,
    role: "user",
    content: prompt,
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
    userId,
    status: "pending",
  });
  await ctx.scheduler.runAfter(0, internal.dispatch.notifyJobCreated, {
    jobId: jobId.toString(),
  });
  return { conversationId, jobId };
}

async function getSandboxAgent(ctx: any) {
  const agents = await ctx.db
    .query("agents")
    .withIndex("by_slug", (q: any) => q.eq("slug", SANDBOX_SLUG))
    .collect();
  const agent = agents[0];
  if (!agent) throw new Error("Sandbox agent not found. Run seed:run first.");
  return agent;
}

/**
 * Test: Gmail send — asks the agent to send "Hi" email using Hometown Roofing template.
 *
 * Run: npx convex run seed:testGmailSend '{}'
 * Then check: npx convex run seed:verifyConversation '{"conversationId":"<id from output>"}'
 */
export const testGmailSend = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Please send an email to angelo@hometownroofingtx.com using your Gmail.
Subject: "Hi from Agent Maker"
Body: Use a professional HTML email format with:
- A greeting: "Hi Angelo,"
- Body: "Just wanted to say Hi and test our Gmail integration is working great!"
- Sign off: "Best regards, Agent Maker"
After sending, confirm the message ID and that it was delivered successfully.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Gmail Send"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Gmail send job dispatched. Check seed:verifyConversation in ~15s.",
    };
  },
});

/**
 * Test: Google Sheets — creates a spreadsheet, writes data, appends rows, reads it back.
 *
 * Run: npx convex run seed:testSpreadsheet '{}'
 * Then check: npx convex run seed:verifyConversation '{"conversationId":"<id from output>"}'
 */
export const testSpreadsheet = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Please do the following Google Sheets operations in order and report each result:
1. Use gsheets_list_spreadsheets to list all spreadsheets in my Google Drive.
2. Create a new spreadsheet titled "Agent Maker Test - ${new Date().toISOString().slice(0, 10)}" with headers: Name, Email, Score, Date.
3. Write 3 sample rows of test data to it (make up realistic data).
4. Append 2 more rows using gsheets_append.
5. Read back the full sheet with gsheets_read and confirm the row count.
6. Report the spreadsheet ID and link so I can open it.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Google Sheets Full Flow"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Spreadsheet test job dispatched. Check seed:verifyConversation in ~30s.",
    };
  },
});

/**
 * Test: Multi-tool — exercises Gmail read + Sheets + memory in one conversation.
 *
 * Run: npx convex run seed:testMultiTool '{}'
 */
export const testMultiTool = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Run through these tests and report each result:
1. Gmail: List my last 5 inbox emails (subject + from + date only).
2. Gmail: List all my Gmail labels.
3. Google Sheets: List all my spreadsheets (names + IDs).
4. Memory: Store this memory — "Multi-tool test run completed on ${new Date().toLocaleDateString()}".
5. Summarize all results in a clean list.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Multi-Tool"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Multi-tool test dispatched. Check seed:verifyConversation in ~30s.",
    };
  },
});

/**
 * Verify the result of a dispatched agent conversation.
 *
 * Run: npx convex run seed:verifyConversation '{"conversationId":"<id>"}'
 */
/**
 * Test: Discord — asks the agent to list Discord servers and channels.
 *
 * Run: npx convex run seed:testDiscord '{}'
 * Then check: npx convex run seed:verifyConversation '{"conversationId":"<id from output>"}'
 */
export const testDiscord = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Please test the Discord integration by doing the following:
1. Use discord_list_guilds to list all Discord servers the bot is in.
2. For the first server you find, use discord_list_channels to list its channels.
3. Report back the server names, IDs, and available channels.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Discord Integration"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Discord test job dispatched. Check seed:verifyConversation in ~15s.",
    };
  },
});

/**
 * Test: Discord send message — asks the agent to send a message to #general.
 *
 * Run: npx convex run seed:testDiscordSend '{}'
 * Then check: npx convex run seed:verifyConversation '{"conversationId":"<id>"}'
 */
export const testDiscordSend = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Send a message to the #general channel (ID: 1490200082241290253) in Aneaire's server. The message should say: "Hello from Agent Maker! 🤖 Discord integration is live and working."`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Discord Send Message"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Discord send message job dispatched. Check seed:verifyConversation in ~15s.",
    };
  },
});

/**
 * Test: Discord thread + reaction — creates a thread and adds a reaction.
 */
export const testDiscordThreadAndReaction = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Please do the following Discord tests in order and report each result:
1. Use discord_send_message to send "🧵 Thread test starting..." to channel 1490200082241290253
2. Use discord_create_thread in channel 1490200082241290253 with name "Agent Test Thread"
3. Use discord_reply_in_thread to send "Hello from inside the thread! ✅" in the new thread
4. Use discord_add_reaction on the message from step 1 with emoji 🎉
Report the message ID, thread ID, and whether each step succeeded.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Discord Thread + Reaction"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Discord thread+reaction job dispatched. Check seed:verifyConversation in ~20s.",
    };
  },
});

/**
 * Ad-hoc: send a DM to a Slack user by name.
 */
export const slackDmKiko = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Find the Slack user named "kiko". Try slack_search_users first; if that fails or returns nothing, fall back to slack_list_users and filter by name. Once found, use slack_send_dm to send him: "👋 Hi Kiko!" Report his user ID and confirm the DM was sent.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TASK: DM kiko"
    );

    return { status: "dispatched", ...result };
  },
});

/**
 * Test: Slack — exercises send_message, list_channels, get_permalink, add_reaction.
 * Run: npx convex run seed:testSlack '{}'
 */
export const testSlack = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Please test the Slack integration end-to-end and report each step:
1. Use slack_list_channels to find the channel named "all-aneaire" and report its ID.
2. Use slack_send_message to post "👋 Hello from Agent Maker — Slack integration test." to that channel. Report the message timestamp.
3. Use slack_get_permalink on the message you just posted and report the URL.
4. Use slack_add_reaction with emoji "white_check_mark" on that message.
5. Use slack_update_message to change the text to "✅ Slack integration test complete."
Report the result of each step concisely.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Slack Integration"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Slack test job dispatched. Check seed:verifyConversation in ~25s, then seed:verifySlackEvents.",
    };
  },
});

/**
 * List ALL agents with slackBotEnabled and their gateway state — used to find
 * which agent actually picked up an inbound mention.
 */
export const listAllSlackBots = internalQuery({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const enabled = agents.filter((a: any) => a.slackBotEnabled === true);
    const out = [];
    for (const a of enabled) {
      const gw = await ctx.db
        .query("slackGatewayState")
        .withIndex("by_agent", (q: any) => q.eq("agentId", a._id))
        .first();
      const convs = await ctx.db
        .query("slackConversationMap")
        .withIndex("by_agent_channel", (q: any) => q.eq("agentId", a._id))
        .collect();
      const events = await ctx.db
        .query("agentEvents")
        .withIndex("by_agent", (q: any) => q.eq("agentId", a._id))
        .order("desc")
        .take(10);
      out.push({
        agentId: a._id,
        name: a.name,
        slug: a.slug,
        authorizedUsers: (a as any).slackAuthorizedUsers ?? [],
        gateway: gw ? { status: gw.status, botUserId: gw.botUserId } : null,
        conversationMapCount: convs.length,
        recentSlackEvents: events
          .filter((e: any) => e.event?.startsWith("slack."))
          .map((e: any) => ({
            event: e.event,
            createdAt: new Date(e._creationTime).toISOString(),
            payload: e.payload,
          })),
      });
    }
    return out;
  },
});

/**
 * Programmatically enable Slack bot on the sandbox agent (skips needing the UI).
 * Adds aneaire010 + kiko as authorized users.
 */
export const enableSlackBotOnSandbox = internalMutation({
  handler: async (ctx) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q: any) => q.eq("slug", SANDBOX_SLUG))
      .first();
    if (!agent) throw new Error("sandbox agent not found");

    await ctx.db.patch(agent._id, {
      slackBotEnabled: true,
      slackBotPrompt:
        "You are HiGantic, a friendly Slack assistant for the Aneaire workspace. You only have access to public knowledge — you cannot run tools or access the team's internal data. Keep replies short, helpful, and use Slack mrkdwn formatting (*bold*, _italic_, `code`).",
      slackAuthorizedUsers: ["U0AS3996N00"], // aneaire010 (kiko intentionally NOT authorized so we can test bot mode)
    } as any);

    return { ok: true, agentId: agent._id };
  },
});

/**
 * Inspect Slack bot state — agent flags + gateway connection status.
 */
export const verifySlackBotState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q: any) => q.eq("slug", SANDBOX_SLUG))
      .first();
    if (!agent) return { error: "sandbox agent not found" };

    const state = await ctx.db
      .query("slackGatewayState")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agent._id))
      .first();

    const convs = await ctx.db
      .query("slackConversationMap")
      .withIndex("by_agent_channel", (q: any) => q.eq("agentId", agent._id))
      .collect();

    return {
      agentId: agent._id,
      enabledToolSets: agent.enabledToolSets,
      slackInToolSets: agent.enabledToolSets?.includes("slack") ?? false,
      slackBotEnabled: (agent as any).slackBotEnabled ?? false,
      slackAuthorizedUsers: (agent as any).slackAuthorizedUsers ?? [],
      slackBotPrompt: (agent as any).slackBotPrompt ?? null,
      slackBotModel: (agent as any).slackBotModel ?? null,
      gatewayState: state
        ? {
            status: state.status,
            botUserId: state.botUserId,
            connectedAt: state.connectedAt
              ? new Date(state.connectedAt).toISOString()
              : null,
          }
        : null,
      conversationMaps: convs.map((c: any) => ({
        channelId: c.slackChannelId,
        channelType: c.channelType,
        mode: c.mode,
        lastMentioner: c.lastMentionerUserId,
      })),
    };
  },
});

/**
 * Verify slack events were emitted to the event bus.
 */
export const verifySlackEvents = internalQuery({
  args: { agentId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const agent = args.agentId
      ? await ctx.db.get(args.agentId as any)
      : await (async () => {
          const agents = await ctx.db
            .query("agents")
            .withIndex("by_slug", (q: any) => q.eq("slug", SANDBOX_SLUG))
            .collect();
          return agents[0];
        })();

    if (!agent) throw new Error("Agent not found.");

    const allEvents = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agent._id))
      .order("desc")
      .take(30);

    const slackEvents = allEvents.filter((e: any) =>
      e.event?.startsWith("slack.")
    );

    return {
      totalRecentEvents: allEvents.length,
      slackEventCount: slackEvents.length,
      slackEvents: slackEvents.map((e: any) => ({
        event: e.event,
        source: e.source,
        payload: e.payload,
        createdAt: new Date(e._creationTime).toISOString(),
      })),
    };
  },
});

/**
 * Verify discord events were emitted to the event bus.
 */
export const verifyDiscordEvents = internalQuery({
  args: { agentId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const agent = args.agentId
      ? await ctx.db.get(args.agentId as any)
      : await (async () => {
          const agents = await ctx.db
            .query("agents")
            .withIndex("by_slug", (q: any) => q.eq("slug", SANDBOX_SLUG))
            .collect();
          return agents[0];
        })();

    if (!agent) throw new Error("Agent not found.");

    const allEvents = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agent._id))
      .order("desc")
      .take(20);

    const discordEvents = allEvents.filter((e: any) =>
      e.event?.startsWith("discord.")
    );

    return {
      totalRecentEvents: allEvents.length,
      discordEventCount: discordEvents.length,
      discordEvents: discordEvents.map((e: any) => ({
        event: e.event,
        source: e.source,
        payload: e.payload,
        createdAt: new Date(e._creationTime).toISOString(),
      })),
    };
  },
});

/**
 * Test: Discord automation — creates an automation triggered by discord.message_sent.
 */
export const testDiscordAutomation = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Please do the following:
1. Use create_automation to create an automation called "Discord Message Logger" that:
   - Triggers on event: discord.message_sent
   - Action: create_note with title "Discord Log" and content "Message sent to channel {{event.channelId}} — ID: {{event.messageId}}"
2. Then use discord_send_message to send "Automation test 🤖" to channel 1490200082241290253
3. Report the automation ID and confirm the message was sent.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Discord Automation"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Discord automation test dispatched. Check seed:verifyConversation in ~20s, then seed:verifyDiscordEvents.",
    };
  },
});

/**
 * Test: Custom HTTP Tools — asks the agent to fetch a joke using the get_joke custom tool.
 *
 * Run: npx convex run seed:testCustomHttpTools '{}'
 * Then check: npx convex run seed:verifyConversation '{"conversationId":"<id from output>"}'
 */
export const testCustomHttpTools = internalMutation({
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);
    const user = await ctx.db.get(agent.userId);
    if (!user) throw new Error("Agent owner not found.");

    const prompt = `Please test the custom HTTP tools by doing the following in order:
1. Use the get_joke tool to fetch a programming joke.
2. Report the full joke (setup + punchline) you received from the API.
3. Confirm the tool call succeeded and show the raw response.`;

    const result = await dispatchAgentPrompt(
      ctx,
      agent._id,
      user._id,
      prompt,
      "TEST: Custom HTTP Tools"
    );

    return {
      status: "dispatched",
      ...result,
      message: "Custom HTTP tools test dispatched. Check seed:verifyConversation in ~20s.",
    };
  },
});

export const verifyConversation = internalQuery({
  args: { conversationId: v.string() },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const allJobs = await ctx.db.query("agentJobs").collect();
    const jobs = allJobs.filter(
      (j: any) => j.conversationId === args.conversationId
    );

    const assistantMessages = messages.filter((m: any) => m.role === "assistant");
    const latestAssistant = assistantMessages[assistantMessages.length - 1];

    return {
      jobStatus: jobs[0]?.status ?? "not found",
      jobError: jobs[0]?.error ?? null,
      messageCount: messages.length,
      assistantStatus: latestAssistant?.status ?? "not found",
      assistantResponse: latestAssistant?.content?.slice(0, 1000) ?? "(empty)",
      toolCalls: latestAssistant?.toolCalls?.map((tc: any) => ({
        name: tc.name,
        output: tc.output ? tc.output.slice(0, 400) : null,
      })) ?? [],
    };
  },
});

export const verifyDiscordGateway = internalQuery({
  args: {},
  handler: async (ctx) => {
    const agent = await getSandboxAgent(ctx);

    const gatewayState = await ctx.db
      .query("discordGatewayState")
      .withIndex("by_agent", (q: any) => q.eq("agentId", agent._id))
      .first();

    const discordMappings = await ctx.db
      .query("discordConversationMap")
      .withIndex("by_agent_channel", (q: any) => q.eq("agentId", agent._id))
      .take(10);

    return {
      gatewayStatus: gatewayState?.status ?? "no_state",
      botUserId: gatewayState?.botUserId ?? null,
      connectedAt: gatewayState?.connectedAt
        ? new Date(gatewayState.connectedAt).toISOString()
        : null,
      discordConversations: discordMappings.map((m: any) => ({
        channelId: m.discordChannelId,
        guildId: m.discordGuildId,
        mode: m.mode,
        conversationId: m.conversationId,
        lastMentionerUsername: m.lastMentionerUsername ?? null,
        lastMentionerUserId: m.lastMentionerUserId ?? null,
      })),
    };
  },
});
