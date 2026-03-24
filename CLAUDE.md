# Agent Maker

## Documentation Rules (Read First)

This file is the primary context source for AI coding agents. Keep it optimized:

- **Be concise** — one line per fact, no prose, no filler words
- **No explanations of why** — agents need what, not why
- **Checklists over paragraphs** — numbered steps, not narratives
- **Update on every feature** — if you add a page type, tool set, or pattern, update the relevant checklist here and in `AGENTS.md` (always kept identical)
- **No duplication** — if it's in `docs/`, link to it; don't repeat it here
- **Inline examples only when the pattern is non-obvious** — skip obvious ones

> When you modify `CLAUDE.md`, you **must** apply the identical change to `AGENTS.md`.

## Project Structure

Monorepo with 3 packages:
- `packages/agent/` — Agent execution server (Hono + Claude SDK). Runs tools, processes jobs, handles webhooks/cron/timers.
- `packages/shared/` — Convex backend (schema, queries, mutations, actions). Shared between agent server and web UI.
- `packages/web/` — React Router web UI (agent management, chat, settings, pages).

## Architecture (Summary)

- **Job System**: Polling-based. Server polls `agentJobs.listPending` every 2s, claims jobs atomically, runs agent via Claude SDK.
- **Tool System**: MCP servers with dynamic tool registration. Tools gated by `enabledToolSets` array on agent config.
- **Event Bus**: All tool actions emit events to `agentEvents` table. Automations subscribe to events.
- **Scheduling**: Server polls `scheduledActions` every 10s and `agentTimers` every 5s for due items.
- **Auth**: Clerk for users, `serverToken` for server-to-Convex auth.
- **Credentials**: Centralized credential store (`credentials` table) with AES-256-GCM encryption. Linked to agents via `agentCredentialLinks`. Runtime falls back to legacy `agentToolConfigs` if no linked credential exists. Registry in `packages/shared/src/credential-types.ts`.
- **Models**: Claude (Anthropic) and Gemini (Google) supported. Routed via `isGeminiModel()`.

## TypeScript Guidelines

- **Always attempt proper types first** — define interfaces for API responses, action configs, and structured objects
- **`any` is acceptable** when: the Convex schema uses `v.any()`, external API responses are untyped, or proper typing would require excessive complexity
- Prefer `Record<string, any>` over bare `any` for objects with unknown keys
- Use `as SomeType` casts only when you control the shape (e.g. Convex query results, external JSON responses)
- Never block a feature on perfect types — a working `any` beats a broken type

## Key Patterns

- Server-facing mutations use `serverToken` auth via `requireServerAuth()`
- User-facing mutations use Clerk auth via `requireAuthUser()`
- All new Convex modules need both user-facing (UI) and server-facing (agent tools) endpoints
- Tool files export a `create*Tools()` function returning an array of MCP tools
- System prompt is dynamically built based on enabled tool sets and context

## Tool Sets (enabledToolSets)

`memory`, `web_search`, `pages`, `custom_http_tools`, `email`, `rag`, `schedules`, `automations`, `timers`, `webhooks`, `agent_messages`, `notion`, `slack`, `google_calendar`, `google_drive`, `google_sheets`, `image_generation`

## Adding a New Tool Set (Checklist)

When adding a new feature or tool set, **all 7 steps are required** or the agent won't fully know about or use it:

1. **Tool file** — Create `packages/agent/src/tools/<name>-tools.ts` exporting `create<Name>Tools()`
2. **MCP server** — Wire into `packages/agent/src/mcp-server.ts`: import + conditional registration in `buildMcpServer()` and `buildAllowedTools()`
3. **System prompt** — Update `packages/agent/src/system-prompt.ts`: add capability description, usage guidelines, **and** an entry in the `allIntegrations` map so disabled tool sets are advertised to users
4. **UI settings** — Add entry to `TOOL_SET_INFO` in `packages/web/app/routes/agents.$agentId.settings.tsx`
5. **Schema** — Add any new tables/indexes in `packages/shared/convex/schema.ts`, plus server-facing and user-facing endpoints
6. **Tool Sets list** — Add the new key to the `enabledToolSets` list in this file (and `AGENTS.md`)
7. **Event Bus** — Every meaningful tool action must emit an event (see Event Bus Rules below)

> **Critical**: Step 3 is the most commonly missed. Without system prompt updates, the agent has the tool but doesn't know to use it effectively. The `allIntegrations` map is also important — it lets the agent tell users about available integrations they haven't enabled yet.

## Adding a New Tool to an Existing Tool Set

1. Add the tool function in the existing `*-tools.ts` file
2. Add the tool name to `buildAllowedTools()` in `mcp-server.ts`
3. Update system prompt guidance if the tool introduces new behavior the agent should know about
4. Add any new Convex endpoints needed
5. **Emit an event** for every meaningful action (see Event Bus Rules below)

## Event Bus Rules

Every tool action that creates, updates, deletes, or sends something **must** emit an event. This is what powers automations, the event log, and workflow triggers.

**Pattern** (in tool handler, after the action succeeds):
```ts
await convexClient.emitEvent(agentId, "category.action", "source_name", {
  // payload: flat key/value fields relevant to the event
});
```

**Naming conventions:**
- Event name: `<category>.<action>` — e.g. `task.created`, `email.sent`, `slack.message_sent`
- Source: tool file name without extension — e.g. `page_tools`, `email_tools`, `slack_tools`
- Payload: flat object with the most useful fields (IDs, names, statuses). No nesting needed.

**After adding new events, also update `WorkflowPage.tsx`:**
- Add the event to `EVENT_OPTIONS` so it appears in the automation trigger picker
- Add payload fields to `PAYLOAD_VARIABLES` under the matching `"category.*"` key so users can copy template vars

**When NOT to emit:** read-only tools (list, get, search) do not need events. Only write/send/create/delete actions.

## Adding a New Workspace Page Type (Checklist)

Workspace pages are tabs in the agent sidebar (tasks, notes, spreadsheet, api, workflow, etc.).
When adding a new page type, **all 7 steps are required**:

1. **`packages/shared/src/types/index.ts`** — Add the string to the `TabType` union AND to `PLAN_LIMITS.allowedPageTypes` for the appropriate plan tiers (free / pro / enterprise)
2. **`packages/shared/convex/schema.ts`** — Add `v.literal("your-type")` to the `sidebarTabs.type` union validator
3. **`packages/shared/convex/sidebarTabs.ts`** — Add `v.literal("your-type")` to the `create` mutation's type arg validator AND add the string to the `allowedPro` array in the plan-gate logic
4. **Page component** — Create `packages/web/app/components/pages/YourPage.tsx`. See UI Conventions below. The component receives `{ tab: Doc<"sidebarTabs"> }` — use `tab.agentId` for all agent-scoped Convex queries.
5. **Route handler** — Add `case "your-type": return <YourPage tab={tab} />;` in `packages/web/app/routes/agents.$agentId.tab.$tabId.tsx`
6. **`packages/web/app/components/AgentSidebar.tsx`** — Add icon to `TAB_ICONS` record + new entry to `PAGE_TYPES` array with `{ type, label, description, icon }`
7. **Backend queries** — Add any new Convex queries/mutations the page needs. If querying by agent (not tab), add a `listByAgent` or similar query using the `by_agent` index. If the page stores its own data, add a new table to `schema.ts` and a corresponding `remove` cascade in `sidebarTabs.ts → remove()`

> **Note**: Page types gated to `pro`/`enterprise` only need to be added to `allowedPro` (step 3). Free-tier types must also be added to `allowedFree`.

## UI Conventions (Web)

All page components follow these patterns — match them exactly for visual consistency:

**Layout shell:**
```tsx
<div className="flex-1 flex flex-col min-h-0">
  {/* Header */}
  <div className="border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between shrink-0">
    ...
  </div>
  {/* Scrollable body */}
  <div className="flex-1 overflow-y-auto p-6">
    <div className="max-w-2xl mx-auto space-y-6">
      ...
    </div>
  </div>
</div>
```

**Section cards:** `rounded-2xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden`

**Form inputs:** `rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none transition-colors`

**Primary button:** `text-xs bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg font-semibold hover:bg-white disabled:opacity-30 transition-all`

**Ghost button:** `text-xs text-zinc-500 px-3 py-2 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors`

**Danger button:** `p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-all`

**Active/enabled toggle:** `text-neon-400 hover:bg-neon-950/30`

**Loading skeleton:** `animate-pulse bg-zinc-800/20 rounded-xl`

**Tech stack:** Tailwind 4, Lucide React icons, Convex `useQuery`/`useMutation`, React 19, React Router 7. No shadcn/ui. Dark theme only (zinc-900/950 base, neon-400 accent).

## System Prompt: Available Integrations

The system prompt (`packages/agent/src/system-prompt.ts`) has two integration-related sections:
- **Capabilities** — lists what's *enabled* so the agent knows what it can do
- **Available Integrations** — lists what's *not enabled* so the agent can inform users about features they could turn on, and directs them to the Settings page in the Agent Maker dashboard

When adding a new tool set, you must add it to **both**:
1. The `capabilities` array (conditional on `has(enabled, "key")`)
2. The `allIntegrations` map (always present, used to compute disabled integrations)

## Dev Commands

```bash
cd packages/shared && npx convex dev     # Run Convex dev server
cd packages/agent && bun run dev         # Run agent server
cd packages/web && bun run dev           # Run web UI
```

## Documentation

Detailed documentation lives in `docs/`. Refer to these when you need deeper context:

- **`docs/advanced/architecture.md`** — Full execution flow, data flow diagrams, database tables, auth model, polling intervals
- **`docs/advanced/event-bus.md`** — Event system, automation triggers, template variables
- **`docs/reference/tool-sets.md`** — Every tool set with all MCP tool names, descriptions, and configs
- **`docs/reference/events.md`** — All event types and payload shapes
- **`docs/reference/env-vars.md`** — Environment variable reference
- **`docs/tools/`** — Per-tool-set detailed docs (one file per integration)
- **`docs/advanced/rest-api.md`** — REST API endpoint system
- **`docs/advanced/adding-features.md`** — Checklists for adding automation actions, event types, etc.
