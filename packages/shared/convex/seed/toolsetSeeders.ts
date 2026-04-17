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
  // All endpoints are free public APIs — no local server or signup needed.
  // httpbin.org  — HTTP echo/inspection service
  // dummyjson.com — fake REST API with rich data
  // pokeapi.co   — public Pokémon API with next-URL pagination
  // open-meteo.com — free weather API, no key required

  const tools: Array<{
    name: string;
    description: string;
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    inputSchema: any;
    headers?: any;
    auth?: any;
    bodyType?: "json" | "form-data" | "url-encoded" | "raw";
    rawBody?: string;
    queryParams?: { name: string; value: string }[];
    pagination?: any;
    responseFormat?: "auto" | "json" | "text";
    fullResponse?: boolean;
    neverError?: boolean;
    timeoutMs?: number;
    followRedirects?: boolean;
  }> = [
    // 1. Basic GET — echo with static query params
    {
      name: "echo_get",
      description: "Echo back query params via httpbin. Verifies GET + static query param injection.",
      endpoint: "https://httpbin.org/get",
      method: "GET",
      queryParams: [{ name: "source", value: "higantic" }],
      inputSchema: {},
    },
    // 2. POST JSON body
    {
      name: "echo_post",
      description: "POST a JSON body to httpbin and get it echoed back. Verifies JSON body serialization.",
      endpoint: "https://httpbin.org/post",
      method: "POST",
      bodyType: "json",
      inputSchema: {
        message: { type: "string", description: "A message to send" },
        value: { type: "number", description: "A numeric value" },
      },
    },
    // 3. Path parameter substitution
    {
      name: "get_user",
      description: "Fetch a user by ID from DummyJSON. Tests {id} path parameter substitution.",
      endpoint: "https://dummyjson.com/users/{id}",
      method: "GET",
      inputSchema: {
        id: { type: "string", description: "User ID to look up, e.g. 1" },
      },
    },
    // 4. Bearer token auth
    {
      name: "bearer_auth_test",
      description: "Hit httpbin /bearer with a Bearer token. Returns 200 + echoes the token if header is present, 401 if missing.",
      endpoint: "https://httpbin.org/bearer",
      method: "GET",
      auth: { type: "bearer", token: "higantic-test-token" },
      inputSchema: {},
    },
    // 5. Basic auth
    {
      name: "basic_auth_test",
      description: "Hit httpbin /basic-auth/admin/secret with Basic auth. Returns 200 if credentials match, 401 otherwise.",
      endpoint: "https://httpbin.org/basic-auth/admin/secret",
      method: "GET",
      auth: { type: "basic", username: "admin", password: "secret" },
      inputSchema: {},
    },
    // 6. Header auth (X-API-Key) — reflected back in response
    {
      name: "header_auth_test",
      description: "Send a custom X-Api-Key header to httpbin /headers. The key is echoed back in the response headers object.",
      endpoint: "https://httpbin.org/headers",
      method: "GET",
      auth: { type: "header", name: "X-Api-Key", value: "higantic-api-key-456" },
      inputSchema: {},
    },
    // 7. Query param auth — reflected back in response args
    {
      name: "query_auth_test",
      description: "Append api_token as a query param to httpbin /get. The token is echoed in the args object.",
      endpoint: "https://httpbin.org/get",
      method: "GET",
      auth: { type: "query", name: "api_token", value: "higantic-query-secret" },
      inputSchema: {},
    },
    // 8. Form-data body
    {
      name: "form_data_post",
      description: "POST multipart/form-data to httpbin. The form fields are echoed back under the 'form' key.",
      endpoint: "https://httpbin.org/post",
      method: "POST",
      bodyType: "form-data",
      inputSchema: {
        name: { type: "string", description: "A name field" },
        email: { type: "string", description: "An email field" },
      },
    },
    // 9. URL-encoded body
    {
      name: "urlencoded_post",
      description: "POST application/x-www-form-urlencoded to httpbin. Fields echoed under the 'form' key.",
      endpoint: "https://httpbin.org/post",
      method: "POST",
      bodyType: "url-encoded",
      inputSchema: {
        username: { type: "string", description: "Username" },
        action: { type: "string", description: "Action to perform" },
      },
    },
    // 10. Pagination — next URL (PokéAPI)
    {
      name: "pokemon_paginated",
      description: "Fetch Pokémon list from PokéAPI using next-URL pagination. Each page has 5 results; follows 'next' field across pages.",
      endpoint: "https://pokeapi.co/api/v2/pokemon?limit=5",
      method: "GET",
      pagination: { mode: "next_url", nextUrlPath: "next", maxPages: 4 },
      inputSchema: {},
    },
    // 11. Pagination — offset (DummyJSON)
    {
      name: "products_paginated",
      description: "Fetch products from DummyJSON using skip-based offset pagination. Fetches 5 pages of 5 items each.",
      endpoint: "https://dummyjson.com/products",
      method: "GET",
      queryParams: [{ name: "limit", value: "5" }],
      pagination: { mode: "offset", paramName: "skip", paramStartValue: 0, paramStep: 5, maxPages: 5 },
      inputSchema: {},
    },
    // 12. Full response — custom HTTP status codes
    {
      name: "check_status",
      description: "Request a specific HTTP status code from httpbin. Full response mode returns status code + headers.",
      endpoint: "https://httpbin.org/status/{code}",
      method: "GET",
      fullResponse: true,
      neverError: true,
      inputSchema: {
        code: { type: "string", description: "HTTP status code to return, e.g. 200, 404, 500" },
      },
    },
    // 13. Timeout test
    {
      name: "slow_request",
      description: "Call httpbin /delay/2 which responds after 2 seconds. Timeout is 5s so it should succeed.",
      endpoint: "https://httpbin.org/delay/2",
      method: "GET",
      timeoutMs: 5000,
      inputSchema: {},
    },
    // 14. Raw body
    {
      name: "raw_body_post",
      description: "POST a raw text body to httpbin /anything. The body is echoed back under the 'data' key.",
      endpoint: "https://httpbin.org/anything",
      method: "POST",
      bodyType: "raw",
      rawBody: "Hello from HiGantic custom HTTP tools!",
      inputSchema: {},
    },
    // 15. Real weather data — static query params (Open-Meteo, no key needed)
    {
      name: "get_weather_manila",
      description: "Fetch real current weather for Manila from Open-Meteo API. No API key required.",
      endpoint: "https://api.open-meteo.com/v1/forecast",
      method: "GET",
      queryParams: [
        { name: "latitude", value: "14.5995" },
        { name: "longitude", value: "120.9842" },
        { name: "current", value: "temperature_2m,wind_speed_10m,weathercode" },
        { name: "timezone", value: "Asia/Manila" },
      ],
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

// ── Local Test Server Tools Seeder (localhost:3737) ─────────────────────
// Used by the DevOps Test Agent to interact with the hono-http-test sandbox.

export async function seedLocalTestServerTools({ ctx, agentId }: SeedContext) {
  const tools: Array<{
    name: string;
    description: string;
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    inputSchema: any;
    headers?: any;
    auth?: any;
    bodyType?: "json" | "form-data" | "url-encoded" | "raw";
    queryParams?: { name: string; value: string }[];
    fullResponse?: boolean;
    neverError?: boolean;
    timeoutMs?: number;
  }> = [
    {
      name: "fire_webhook",
      description:
        "Fire a webhook event at the local test server. Triggers automation rules that update tasks in the SQLite database. Use event_type values: deploy.success, pr.overdue, bug.reported, task.created, or any custom string.",
      endpoint: "http://localhost:3737/webhook",
      method: "POST",
      bodyType: "json",
      inputSchema: {
        source: { type: "string", description: "Who sent the event, e.g. 'github', 'ci-server', 'monitoring'" },
        event_type: { type: "string", description: "The event name, e.g. 'deploy.success', 'pr.overdue', 'bug.reported', 'task.created'" },
        payload: { type: "string", description: "JSON string of extra event data. For deploy.success include task_title. For bug.reported include title and severity='critical'. For pr.overdue include pr_number. For task.created include title and priority='urgent'." },
      },
    },
    {
      name: "list_tasks",
      description: "Fetch all tasks from the local SQLite database. Returns id, title, status, priority, assigned_to, and timestamps.",
      endpoint: "http://localhost:3737/tasks",
      method: "GET",
      inputSchema: {},
    },
    {
      name: "create_task",
      description: "Create a new task in the local SQLite database.",
      endpoint: "http://localhost:3737/tasks",
      method: "POST",
      bodyType: "json",
      inputSchema: {
        title: { type: "string", description: "Task title" },
        status: { type: "string", description: "pending, in_progress, or done" },
        priority: { type: "string", description: "urgent, high, medium, or low" },
        assigned_to: { type: "string", description: "Name of the person assigned" },
      },
    },
    {
      name: "update_task",
      description: "Update the status, priority, or assignee of a task by its numeric ID.",
      endpoint: "http://localhost:3737/tasks/{id}",
      method: "PATCH",
      bodyType: "json",
      inputSchema: {
        id: { type: "string", description: "Numeric task ID, e.g. '1'" },
        status: { type: "string", description: "New status: pending, in_progress, or done" },
        priority: { type: "string", description: "New priority: urgent, high, medium, or low" },
        assigned_to: { type: "string", description: "New assignee name" },
      },
    },
    {
      name: "list_automation_logs",
      description: "Fetch the automation run history. Shows which rules fired, what they did, and which task was affected.",
      endpoint: "http://localhost:3737/automations/logs",
      method: "GET",
      inputSchema: {},
    },
    {
      name: "list_automation_rules",
      description: "List all available automation rules on the test server and which events they match.",
      endpoint: "http://localhost:3737/automations/rules",
      method: "GET",
      inputSchema: {},
    },
    {
      name: "reset_database",
      description: "Reset the local test server database to its initial state. Clears all webhook events, automation logs, and resets tasks to the original 5 seeded tasks.",
      endpoint: "http://localhost:3737/demo/reset",
      method: "POST",
      inputSchema: {},
    },
  ];

  const ids = [];
  for (const t of tools) {
    const id = await ctx.db.insert("customTools", { agentId, ...t });
    ids.push(id);
  }
  return { localToolIds: ids };
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
