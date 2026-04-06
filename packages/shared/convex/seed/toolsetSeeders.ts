import { SeedContext } from "./registry";

// ── Memory Seeder ────────────────────────────────────────────────────────

export async function seedMemory({ ctx, agentId }: SeedContext) {
  const memories = [
    { content: "User prefers concise, actionable responses over long explanations", category: "preferences" },
    { content: "Project deadline is end of Q2 2026 — June 30th", category: "project" },
    { content: "Tech stack: React 19, Convex, Hono, Claude Agent SDK, Tailwind CSS 4", category: "context" },
    { content: "Team size is 3 developers — Alex (frontend), Jordan (backend), Sam (fullstack)", category: "context" },
    { content: "Weekly standup every Monday at 10am Pacific time", category: "schedule" },
  ];

  const ids = [];
  for (const mem of memories) {
    const id = await ctx.db.insert("memories", { agentId, ...mem });
    ids.push(id);
  }
  return { memoryIds: ids };
}

// ── Automations Seeder ───────────────────────────────────────────────────

export async function seedAutomations({ ctx, agentId }: SeedContext) {
  const now = Date.now();

  const automationDefs = [
    {
      name: "Task Completion Notifier",
      description: "When a task is marked done, store a memory of the completion",
      trigger: { event: "task.updated", filter: { status: "done" } },
      actions: [
        {
          type: "store_memory" as const,
          config: { template: "Task completed: {{title}} (was {{previousStatus}})" },
        },
      ],
    },
    {
      name: "New Task Logger",
      description: "When a new task is created, auto-create a note logging the task",
      trigger: { event: "task.created" },
      actions: [
        {
          type: "create_note" as const,
          config: {
            title: "New Task: {{title}}",
            content: "A new task was created.\n\n- **Priority:** {{priority}}\n- **Status:** {{status}}\n- **Tags:** {{tags}}",
          },
        },
      ],
    },
    {
      name: "Task Note Creator (Run Prompt)",
      description: "When a task is created, run a prompt that creates a detailed note about it",
      trigger: { event: "task.created" },
      actions: [
        {
          type: "run_prompt" as const,
          config: {
            prompt: "A new task was just created: \"{{event.title}}\" with priority {{event.priority}} and status {{event.status}}. Please create a note in the Meeting Notes page documenting this task with any relevant context, next steps, and considerations.",
          },
        },
      ],
    },
  ];

  const ids = [];
  for (const def of automationDefs) {
    const id = await ctx.db.insert("automations", {
      agentId,
      name: def.name,
      description: def.description,
      trigger: def.trigger,
      actions: def.actions,
      isActive: true,
      runCount: 0,
      createdAt: now,
    });
    ids.push(id);
  }
  return { automationIds: ids };
}

// ── Schedules Seeder ─────────────────────────────────────────────────────

export async function seedSchedules({ ctx, agentId }: SeedContext) {
  const now = Date.now();

  const id = await ctx.db.insert("scheduledActions", {
    agentId,
    name: "Daily Summary",
    description: "Generate a summary of completed tasks and upcoming deadlines every morning",
    schedule: "0 9 * * *",
    scheduleType: "cron",
    action: {
      type: "run_prompt",
      config: {
        prompt:
          "Summarize today's completed tasks and upcoming deadlines. List any tasks that are overdue or at risk.",
      },
    },
    status: "paused", // paused so it doesn't fire during testing
    timezone: "America/Los_Angeles",
    runCount: 0,
    createdAt: now,
  });

  return { scheduledActionIds: [id] };
}

// ── Timers Seeder ────────────────────────────────────────────────────────

export async function seedTimers({ ctx, agentId }: SeedContext) {
  const now = Date.now();

  const id = await ctx.db.insert("agentTimers", {
    agentId,
    label: "Follow up on auth provider decision",
    fireAt: now - 86400000, // 1 day in the past
    action: {
      type: "send_message",
      config: {
        prompt: "Reminder: follow up on the SSO provider decision from last week's meeting.",
      },
    },
    status: "cancelled", // cancelled so it doesn't fire, but visible in history
    createdAt: now - 172800000, // created 2 days ago
  });

  return { timerIds: [id] };
}

// ── Custom HTTP Tools Seeder ─────────────────────────────────────────────

export async function seedCustomHttpTools({ ctx, agentId }: SeedContext) {
  const tools = [
    {
      name: "get_joke",
      description: "Fetch a random programming joke from the public joke API",
      endpoint: "https://official-joke-api.appspot.com/jokes/programming/random",
      method: "GET" as const,
      inputSchema: {},
    },
    {
      name: "get_cat_fact",
      description: "Get a random cat fact from the Cat Facts API",
      endpoint: "https://catfact.ninja/fact",
      method: "GET" as const,
      inputSchema: {},
    },
    {
      name: "get_ip_info",
      description: "Look up geolocation and info for an IP address. Pass ?query=<ip> to look up a specific IP, or omit for the current IP.",
      endpoint: "http://ip-api.com/json",
      method: "GET" as const,
      inputSchema: {},
    },
  ];

  const ids = [];
  for (const t of tools) {
    const id = await ctx.db.insert("customTools", { agentId, ...t });
    ids.push(id);
  }
  return { customToolIds: ids };
}

// ── Events Seeder ────────────────────────────────────────────────────────

export async function seedEvents({ ctx, agentId }: SeedContext) {
  const now = Date.now();

  const eventDefs = [
    {
      event: "task.created",
      source: "page_tools",
      payload: { title: "Implement user auth", status: "todo", priority: "high" },
      createdAt: now - 7200000, // 2 hours ago
    },
    {
      event: "task.updated",
      source: "page_tools",
      payload: { title: "Implement user auth", status: "in_progress", previousStatus: "todo" },
      createdAt: now - 3600000, // 1 hour ago
    },
    {
      event: "automation.triggered",
      source: "automation",
      payload: { automationName: "New Task Logger", triggerEvent: "task.created" },
      createdAt: now - 7100000,
    },
  ];

  const ids = [];
  for (const evt of eventDefs) {
    const id = await ctx.db.insert("agentEvents", { agentId, ...evt });
    ids.push(id);
  }
  return { eventIds: ids };
}
