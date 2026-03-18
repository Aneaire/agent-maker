# Agent Maker

## Project Structure

Monorepo with 3 packages:
- `packages/agent/` — Agent execution server (Hono + Claude SDK). Runs tools, processes jobs, handles webhooks/cron/timers.
- `packages/shared/` — Convex backend (schema, queries, mutations, actions). Shared between agent server and web UI.
- `packages/web/` — React Router web UI (agent management, chat, settings, pages).

## Architecture

- **Job System**: Polling-based. Server polls `agentJobs.listPending` every 2s, claims jobs atomically, runs agent via Claude SDK.
- **Tool System**: MCP servers with dynamic tool registration. Tools gated by `enabledToolSets` array on agent config.
- **Event Bus**: All tool actions emit events to `agentEvents` table. Automations subscribe to events.
- **Scheduling**: Server polls `scheduledActions` every 10s and `agentTimers` every 5s for due items.
- **Auth**: Clerk for users, `serverToken` for server-to-Convex auth.

## Tool Sets (enabledToolSets)

`memory`, `web_search`, `pages`, `custom_http_tools`, `email`, `rag`, `schedules`, `automations`, `timers`, `webhooks`, `agent_messages`, `notion`

## Key Patterns

- Server-facing mutations use `serverToken` auth via `requireServerAuth()`
- User-facing mutations use Clerk auth via `requireAuthUser()`
- All new Convex modules need both user-facing (UI) and server-facing (agent tools) endpoints
- Tool files export a `create*Tools()` function returning an array of MCP tools
- System prompt is dynamically built based on enabled tool sets and context

## Adding a New Tool Set (Checklist)

When adding a new feature or tool set, **all 5 steps are required** or the agent won't fully know about or use it:

1. **Tool file** — Create `packages/agent/src/tools/<name>-tools.ts` exporting `create<Name>Tools()`
2. **MCP server** — Wire into `packages/agent/src/mcp-server.ts`: import + conditional registration in `buildMcpServer()` and `buildAllowedTools()`
3. **System prompt** — Update `packages/agent/src/system-prompt.ts`: add capability description and any usage guidelines so the agent knows *when and how* to use the tool
4. **UI settings** — Add entry to `TOOL_SET_INFO` in `packages/web/app/routes/agents.$agentId.settings.tsx`
5. **Schema** — Add any new tables/indexes in `packages/shared/convex/schema.ts`, plus server-facing and user-facing endpoints

> **Critical**: Step 3 is the most commonly missed. Without system prompt updates, the agent has the tool but doesn't know to use it effectively.

## Adding a New Tool to an Existing Tool Set

1. Add the tool function in the existing `*-tools.ts` file
2. Add the tool name to `buildAllowedTools()` in `mcp-server.ts`
3. Update system prompt guidance if the tool introduces new behavior the agent should know about
4. Add any new Convex endpoints needed

## Adding a New Automation Action Type

1. Add the `case` in `processAutomations()` in `server.ts`
2. Add the `case` in `executeScheduledActions()` if it should be schedulable
3. Add the `case` in `executeTimers()` if it should be timer-triggerable
4. Update automation creation UI if user-facing

## Adding a New Event Type

1. Add `convexClient.emitEvent()` call where the event originates
2. Document the event name and payload shape (for automation template variables)
3. Events automatically become available as automation triggers — no extra wiring needed

## Dev Commands

```bash
cd packages/shared && npx convex dev     # Run Convex dev server
cd packages/agent && bun run dev         # Run agent server
cd packages/web && bun run dev           # Run web UI
```

---

## Architecture Deep Dive

### Execution Flow

1. **User sends message** → Web UI creates a job in `agentJobs` table
2. **Server polls** (`server.ts`) every 2s, claims job atomically
3. **Router** decides: draft agent → `runCreator()`, live agent → `runAgent()`, Gemini model → `runGeminiAgent()`
4. **`runAgent()`** loads agent config, conversation history, memories, tabs, documents, schedules, automations
5. **System prompt built** dynamically via `buildSystemPrompt()` based on `enabledToolSets`
6. **MCP tools registered** dynamically via `buildMcpServer()` based on `enabledToolSets`
7. **Claude SDK streams** response → `StreamFlusher` debounces updates to Convex (50-100ms)
8. **Tool calls** are executed via MCP, results streamed back, events emitted to event bus
9. **Final flush** marks message as `done` or `error`

### System Prompt Construction (`system-prompt.ts`)

The system prompt is **dynamically assembled** — each section only appears if its tool set is enabled:

| Section | Gate | Purpose |
|---|---|---|
| Memories | `memory` | Injects stored memories so agent has context |
| Pages | `pages` | Lists existing pages (tasks, notes, spreadsheets) |
| Knowledge Base | `rag` | Lists uploaded documents, tells agent to use `search_documents` |
| Custom Tools | `custom_http_tools` | Lists configured HTTP tool names |
| Schedules | `schedules` | Shows active cron jobs and intervals |
| Automations | `automations` | Shows active event→action rules |
| Capabilities list | (all enabled) | Bullet list of what the agent can do |
| Autonomy Guidelines | `pages` | Tells agent to proactively create pages |
| Scheduling Guidelines | `schedules` or `timers` | When/how to use scheduling tools |
| Automation Guidelines | `automations` | When/how to create automations |
| Inter-Agent Guidelines | `agent_messages` | How to delegate to other agents |
| Custom Tool Guidance | `custom_http_tools` | Tells agent to suggest tool configs when it can't do something |

### Tool Registration (`mcp-server.ts`)

Tools are registered via MCP using `create*Tools()` functions, gated by `enabledToolSets`:

| Tool Set | File | Tools |
|---|---|---|
| `memory` | `memory-tools.ts` | `store_memory`, `recall_memory`, `search_memories` |
| `pages` | `page-tools.ts` | `create_page`, `add_task`, `update_task`, + dynamic per-tab tools |
| `web_search` | (native SDK) | `WebSearch`, `WebFetch` — not MCP, uses Claude SDK built-in |
| `rag` | `rag-tools.ts` | `search_documents` |
| `email` | `email-tools.ts` | `send_email` |
| `custom_http_tools` | `custom-http-tools.ts` | `custom_<name>` per user-defined tool |
| `schedules` | `schedule-tools.ts` | `create_schedule`, `list_schedules`, `pause_schedule`, `resume_schedule`, `delete_schedule` |
| `automations` | `automation-tools.ts` | `create_automation`, `list_automations`, `delete_automation` |
| `timers` | `timer-tools.ts` | `set_timer`, `list_timers`, `cancel_timer` |
| `webhooks` | `webhook-management-tools.ts` | `fire_webhook`, `list_events` |
| `agent_messages` | `agent-message-tools.ts` | `list_sibling_agents`, `send_to_agent`, `check_agent_messages`, `respond_to_agent` |
| `notion` | `notion-tools.ts` | `notion_search`, `notion_query_database`, `notion_create_page`, `notion_update_page`, `notion_get_page`, `notion_append_blocks` |
| (always on) | `suggest-tools.ts` | `suggest_replies`, `ask_questions` — core UX, not gated |

### Allowed Tools (`buildAllowedTools`)

Claude SDK requires an explicit allowlist. `buildAllowedTools()` mirrors the MCP registration — every tool registered in `buildMcpServer()` must also be listed in `buildAllowedTools()` with its `mcp__agent-tools__<name>` prefix.

### Event Bus

All tool actions emit events to `agentEvents` table via `convexClient.emitEvent()`. Events drive:
- **Automations**: matched by `trigger.event` field, filtered by `trigger.filter`
- **Outgoing webhooks**: fired for matching event types
- Template variables: `{{event.title}}`, `{{event.status}}`, etc. replaced in action configs

### Server-Side Executors (`server.ts`)

Three polling loops run independently:
- **Jobs**: every 2s — agent conversation runs
- **Schedules**: every 10s — cron/interval scheduled actions
- **Timers**: every 5s — delayed one-time actions

Both schedules and timers can execute: `send_email`, `create_task`, `fire_webhook`, `run_prompt`, `send_message`.

### General Rules

- **Every Convex module** needs both server-facing (`requireServerAuth`) and user-facing (`requireAuthUser`) endpoints
- **Tool names** in `buildAllowedTools()` must match exactly: `mcp__agent-tools__<tool_name>`
- **`web_search`** is special — it uses native Claude SDK tools (`WebSearch`, `WebFetch`), not MCP
- **`suggest_replies` and `ask_questions`** are always registered (core UX), never gated by `enabledToolSets`
- **Custom HTTP tools** are dynamic — one MCP tool per user-configured endpoint, named `custom_<name>`
- **Page tools** are partially dynamic — base tools always registered, per-tab tools added based on existing tabs
