import { PageSeedContext } from "./registry";

// ── Tasks Seeder ─────────────────────────────────────────────────────────

export async function seedTasks({ ctx, agentId, tabId }: PageSeedContext) {
  const tasks = [
    {
      title: "Set up CI/CD pipeline",
      description: "Configure GitHub Actions for automated testing and deployment to staging.",
      status: "done",
      priority: "high" as const,
      tags: ["devops", "infrastructure"],
      sortOrder: 0,
    },
    {
      title: "Design landing page",
      description: "Create wireframes and high-fidelity mockups for the marketing landing page.",
      status: "done",
      priority: "medium" as const,
      tags: ["design", "marketing"],
      sortOrder: 1,
    },
    {
      title: "Implement user authentication",
      description: "Integrate Clerk for OAuth and email/password auth. Includes SSO support.",
      status: "in_progress",
      priority: "high" as const,
      tags: ["backend", "security"],
      sortOrder: 2,
    },
    {
      title: "Write API documentation",
      description: "Document all REST endpoints with request/response examples using OpenAPI spec.",
      status: "in_progress",
      priority: "medium" as const,
      tags: ["docs", "api"],
      sortOrder: 3,
    },
    {
      title: "Add email notifications",
      description: "Send transactional emails for key user events: welcome, task assigned, weekly digest.",
      status: "todo",
      priority: "low" as const,
      tags: ["feature", "email"],
      sortOrder: 4,
    },
    {
      title: "Performance audit",
      description: "Profile the app for slow queries, large bundle sizes, and memory leaks. Target LCP < 2s.",
      status: "todo",
      priority: "high" as const,
      tags: ["ops", "performance"],
      sortOrder: 5,
    },
  ];

  const ids = [];
  for (const task of tasks) {
    const id = await ctx.db.insert("tabTasks", { tabId, agentId, ...task });
    ids.push(id);
  }
  return { taskIds: ids };
}

// ── Notes Seeder ─────────────────────────────────────────────────────────

export async function seedNotes({ ctx, agentId, tabId }: PageSeedContext) {
  const now = Date.now();

  const notes = [
    {
      title: "Sprint Planning — Week 12",
      content: `## Sprint Goals
- Complete user auth integration (Clerk)
- Finalize API documentation
- Begin performance audit

## Action Items
- [ ] Alex: Finish login/signup UI components
- [ ] Jordan: Set up SSO provider connection
- [ ] Sam: Write endpoint docs for /agents and /conversations

## Notes
- Stakeholder demo scheduled for Friday 3pm
- Need to decide on SSO provider by Wednesday
- Performance budget: LCP < 2s, FID < 100ms`,
      tags: ["sprint", "planning"],
      updatedAt: now - 86400000,
    },
    {
      title: "Architecture Decision: Event Bus",
      content: `## Context
We need an event-driven system for automations. Two options considered:

## Option A: Convex-native (chosen)
- Events stored in \`agentEvents\` table
- Automations query events on insert via triggers
- Pros: No external deps, real-time via Convex subscriptions
- Cons: 7-day retention, polling for complex patterns

## Option B: External (Redis Streams)
- Events published to Redis
- Pros: High throughput, flexible consumers
- Cons: Additional infra, cost, latency for reads

## Decision
Going with Option A. Simpler architecture, good enough for current scale (< 1000 events/day per agent). Can revisit if we hit performance limits.`,
      tags: ["architecture", "decision"],
      updatedAt: now - 259200000,
    },
    {
      title: "Onboarding Checklist",
      content: `## New Developer Setup

### Prerequisites
- [ ] Node.js 22+ installed
- [ ] Bun runtime installed
- [ ] Git configured with SSH key

### Project Setup
- [ ] Clone the repo
- [ ] Copy \`.env.example\` to \`.env\` and fill in values
- [ ] Run \`bun install\` at project root
- [ ] Start Convex dev: \`cd packages/shared && npx convex dev\`
- [ ] Start agent server: \`cd packages/agent && bun run dev\`
- [ ] Start web app: \`cd packages/web && bun run dev\`

### Verify
- [ ] Can log in via Clerk
- [ ] Can create a new agent
- [ ] Can send a message and get a response
- [ ] Agent can create tasks and notes via tools`,
      tags: ["onboarding", "docs"],
      updatedAt: now - 604800000,
    },
  ];

  const ids = [];
  for (const note of notes) {
    const id = await ctx.db.insert("tabNotes", { tabId, agentId, ...note });
    ids.push(id);
  }
  return { noteIds: ids };
}

// ── Spreadsheet Seeder ───────────────────────────────────────────────────

export async function seedSpreadsheet({ ctx, agentId, tabId }: PageSeedContext) {
  // Create columns
  const columnDefs = [
    { name: "Name", type: "text" as const, sortOrder: 0 },
    { name: "Email", type: "text" as const, sortOrder: 1 },
    { name: "Company", type: "text" as const, sortOrder: 2 },
    { name: "Last Contact", type: "date" as const, sortOrder: 3 },
    { name: "Active", type: "checkbox" as const, sortOrder: 4 },
  ];

  const columnIds = [];
  for (const col of columnDefs) {
    const id = await ctx.db.insert("tabSpreadsheetColumns", { tabId, agentId, ...col });
    columnIds.push(id);
  }

  // Create rows
  const rows = [
    {
      rowIndex: 0,
      data: {
        Name: "Sarah Chen",
        Email: "sarah@acmecorp.com",
        Company: "Acme Corp",
        "Last Contact": "2026-03-20",
        Active: true,
      },
    },
    {
      rowIndex: 1,
      data: {
        Name: "Marcus Johnson",
        Email: "marcus@techstart.io",
        Company: "TechStart",
        "Last Contact": "2026-03-15",
        Active: true,
      },
    },
    {
      rowIndex: 2,
      data: {
        Name: "Elena Rodriguez",
        Email: "elena@designhub.co",
        Company: "DesignHub",
        "Last Contact": "2026-02-28",
        Active: false,
      },
    },
    {
      rowIndex: 3,
      data: {
        Name: "David Kim",
        Email: "david@cloudnine.dev",
        Company: "CloudNine",
        "Last Contact": "2026-03-22",
        Active: true,
      },
    },
  ];

  const rowIds = [];
  for (const row of rows) {
    const id = await ctx.db.insert("tabSpreadsheetRows", { tabId, agentId, ...row });
    rowIds.push(id);
  }

  return { columnIds, rowIds };
}

// ── Markdown Seeder ──────────────────────────────────────────────────────

export async function seedMarkdown({ ctx, tabId }: PageSeedContext) {
  // Markdown pages store content in the tab's config field
  await ctx.db.patch(tabId, {
    config: {
      content: `# Project Documentation

## Overview
Agent Maker is a SaaS platform for creating custom AI agents with persistent memory, tool access, and workspace management.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind CSS 4
- **Backend**: Convex (serverless database + functions)
- **Agent Runtime**: Hono server + Claude Agent SDK + MCP tools
- **Auth**: Clerk (OAuth + email/password)

## Key Concepts

### Agents
Each agent has a system prompt, enabled tool sets, and a model configuration. Agents process user messages via a job queue.

### Pages
Agents maintain workspace pages (tasks, notes, spreadsheets) that they can read and modify through tools.

### Automations
Event-driven rules: when a tool action emits an event (e.g. "task.created"), matching automations execute their action chains.

## API Reference
See the Agent API tab for REST endpoint documentation.
`,
    },
  });

  return { updated: true };
}

// ── API Endpoints Seeder ─────────────────────────────────────────────────

export async function seedApiEndpoints({ ctx, agentId, tabId }: PageSeedContext) {
  const endpoints = [
    {
      name: "Get Status",
      slug: "get-status",
      method: "GET" as const,
      description: "Returns the agent's current status, recent activity, and task summary.",
      promptTemplate:
        "Return the current agent status and a summary of recent activity. Include counts of tasks by status (todo, in_progress, done) and the last 3 events. Format as JSON.",
      responseFormat: "json" as const,
      isActive: true,
    },
    {
      name: "Process Feedback",
      slug: "process-feedback",
      method: "POST" as const,
      description: "Accepts user feedback, creates a task if actionable, and stores as memory.",
      promptTemplate:
        "Process the user feedback in the request body. If the feedback is actionable, create a task for it. Always store the feedback as a memory. Return an acknowledgment with what actions were taken. Format as JSON.",
      responseFormat: "json" as const,
      isActive: true,
    },
  ];

  const ids = [];
  for (const ep of endpoints) {
    const id = await ctx.db.insert("tabApiEndpoints", { tabId, agentId, ...ep });
    ids.push(id);
  }
  return { endpointIds: ids };
}
