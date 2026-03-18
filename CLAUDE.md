# Agent Maker

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
- **Models**: Claude (Anthropic) and Gemini (Google) supported. Routed via `isGeminiModel()`.

## Key Patterns

- Server-facing mutations use `serverToken` auth via `requireServerAuth()`
- User-facing mutations use Clerk auth via `requireAuthUser()`
- All new Convex modules need both user-facing (UI) and server-facing (agent tools) endpoints
- Tool files export a `create*Tools()` function returning an array of MCP tools
- System prompt is dynamically built based on enabled tool sets and context

## Tool Sets (enabledToolSets)

`memory`, `web_search`, `pages`, `custom_http_tools`, `email`, `rag`, `schedules`, `automations`, `timers`, `webhooks`, `agent_messages`, `notion`, `slack`, `google_calendar`, `google_drive`, `google_sheets`, `image_generation`

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
