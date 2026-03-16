# Agent Maker

A platform for creating custom AI agents powered by Claude. Users design agents through a conversational creator flow, then interact with them via a chat UI. Each agent gets its own workspace with configurable tools, persistent memory, and dynamic pages.

## Architecture

Monorepo with three packages:

- **`packages/shared`** — Convex backend (database schema, queries, mutations, server auth)
- **`packages/web`** — React Router frontend (dashboard, agent creator, chat UI, page renderers)
- **`packages/agent`** — Agent runtime server (Hono + Claude Agent SDK, job polling, MCP tool server)

## How It Works

1. User navigates to `/agents/new` — a creator session starts automatically
2. The **Creator Agent** (Claude) greets the user and offers two paths: pick a **starter template** or build from scratch
3. The creator walks through: name, purpose, personality, system prompt, tool sets, model, starter pages, and icon
4. Users can upload a custom avatar via Convex file storage from the preview panel
5. On finalization (with validation), the draft agent becomes active and appears on the dashboard
6. Users chat with their agent at `/agents/{agentId}/chat/{conversationId}`
7. The agent runtime polls for pending jobs, claims them, and runs Claude with the agent's configured tools
8. Agents can autonomously create pages, store memories, search the web, and call external APIs

### Starter Templates

The creator offers pre-built templates to get started quickly:

| Template | Description | Starter Pages |
|----------|-------------|---------------|
| **Customer Support** | Friendly support agent with ticket tracking | Open Tickets, Knowledge Base |
| **Research Assistant** | Thorough researcher with source tracking | Research Notes, Sources |
| **Project Manager** | Task and deadline management | Project Tasks, Meeting Notes, Timeline |
| **Writing Assistant** | Drafting, editing, and content improvement | Drafts, Ideas |
| **Data Analyst** | Data organization and analysis | Data Tracker, Analysis Reports |

Templates set name, description, system prompt, model, tool sets, and create initial pages — all customizable after.

## Agent Tool System

Every created agent gets a dynamically-assembled set of tools based on its `enabledToolSets` configuration. Tools are registered as MCP tools and gated at both the server level (tool registration) and the SDK level (allowed tools list).

### Tool Sets

Each tool set can be enabled or disabled per-agent during creation or in settings.

#### `memory` — Persistent Memory

Agents remember information across conversations.

| Tool | Description |
|------|-------------|
| `store_memory` | Save a piece of information with an optional category (e.g. "preference", "work", "project") |
| `recall_memory` | Full-text search across stored memories |
| `search_memories` | List all memories, optionally filtered by query |

#### `web_search` — Web Search & Fetch

Agents can access live information from the internet.

| Tool | Description |
|------|-------------|
| `WebSearch` | Search the web (built-in Claude Agent SDK tool) |
| `WebFetch` | Fetch and read web pages (built-in Claude Agent SDK tool) |

#### `pages` — Workspace Pages

Agents can autonomously create and manage structured pages that appear in the user's sidebar. This is the core workspace system — agents don't just chat, they build and maintain organized data.

| Tool | Description |
|------|-------------|
| `create_page` | Create a new page of any type (tasks, notes, spreadsheet, markdown, data_table) |

**Tasks pages** — Kanban-style task boards:

| Tool | Description |
|------|-------------|
| `create_task` | Create a task with title, description, status (todo/in_progress/done), and priority (low/medium/high) |
| `update_task` | Update any task field |
| `list_tasks` | List all tasks on a board |

**Notes pages** — Markdown note collections:

| Tool | Description |
|------|-------------|
| `save_note` | Create a new note with title and markdown content |
| `update_note` | Update an existing note's title or content |
| `list_notes` | List all notes on a page |

**Spreadsheet pages** — Structured data tables with typed columns:

| Tool | Description |
|------|-------------|
| `add_spreadsheet_column` | Define a column with name and type (text, number, date, checkbox) |
| `add_spreadsheet_row` | Add a row with data mapped to column names |
| `update_spreadsheet_row` | Update an existing row's data |
| `list_spreadsheet_data` | Get all columns and rows |

**Markdown / Data Table pages** — Static content the agent writes:

| Tool | Description |
|------|-------------|
| `write_page_content` | Write or overwrite the full page content (markdown or plain text) |

#### `custom_http_tools` — External API Integration

Users can configure custom HTTP endpoints in agent settings. Each becomes a tool the agent can call autonomously.

| Tool | Description |
|------|-------------|
| `custom_{name}` | Dynamically generated per configuration — calls the user-defined HTTP endpoint with method, headers, and input schema |

Features:
- Supports GET, POST, PUT, DELETE, PATCH methods
- User-defined input schemas (typed fields)
- Custom headers (for API keys, auth tokens)
- 15-second timeout with abort controller
- Response truncation at 10KB

#### Always-On Tools (not gated by `enabledToolSets`)

These are core UX tools that every agent gets regardless of configuration:

| Tool | Description |
|------|-------------|
| `suggest_replies` | Render 2-4 clickable follow-up suggestion buttons in the chat UI |
| `ask_questions` | Present interactive multiple-choice question cards (up to 6 questions, 2-6 options each) |

### Page Types by Plan

| Page Type | Free | Pro | Enterprise |
|-----------|------|-----|------------|
| Tasks | Yes | Yes | Yes |
| Notes | Yes | Yes | Yes |
| Markdown | Yes | Yes | Yes |
| Data Table | Yes | Yes | Yes |
| Spreadsheet | - | Yes | Yes |
| PostgreSQL | - | Yes | Yes |
| API Endpoints | - | Yes | Yes |

### Plan Limits

| Limit | Free | Pro | Enterprise |
|-------|------|-----|------------|
| Max agents | 1 | 10 | 100 |
| Concurrent jobs | 1 | 5 | 20 |
| Pages per agent | 5 | 20 | 50 |
| Postgres connections | 0 | 1 | 5 |

## Agent Runtime

The runtime (`packages/agent`) is a standalone Hono server that:

1. **Polls** Convex every 2 seconds for pending `agentJobs`
2. **Claims** jobs atomically (prevents double-processing)
3. **Routes** to `runCreator` (draft agents) or `runAgent` (active agents)
4. **Builds** an MCP tool server dynamically based on the agent's `enabledToolSets` and existing pages
5. **Streams** responses back to the database with debounced mutations (50-100ms)
6. **Manages** concurrency with a bounded process pool (default: 20 concurrent, 5-minute timeout)

### REST API Endpoints (Pro+)

Agents can be exposed as REST APIs. External systems call `POST /api/{agentId}/{endpointSlug}` with an API key, and the agent processes the request and returns JSON or text.

## Tech Stack

- **Frontend**: React 19, React Router, Tailwind CSS, Lucide icons
- **Backend**: Convex (database + serverless functions)
- **Auth**: Clerk (React + Convex integration)
- **Agent Runtime**: Hono (HTTP server), Claude Agent SDK (agentic loop + MCP)
- **AI**: Claude (Sonnet 4.6 default, Opus 4.6 and Haiku 4.5 available)

## Development

```bash
# Install dependencies
bun install

# Start all services (run in separate terminals)
cd packages/shared && bun run dev    # Convex dev server
cd packages/web && bun run dev       # React Router dev server
cd packages/agent && bun run dev     # Agent runtime (with --watch)
```

### Environment Variables

**`packages/shared`**:
- Convex deployment URL (auto-configured by `convex dev`)

**`packages/agent`**:
- `CONVEX_URL` — Convex deployment URL
- `AGENT_SERVER_TOKEN` — Shared secret for server-to-server auth
- `PORT` — Server port (default: 3001)
- `POLL_INTERVAL_MS` — Job polling interval (default: 2000)
- `MAX_CONCURRENT_AGENTS` — Max concurrent agent runs (default: 20)
- `AGENT_TIMEOUT_MS` — Per-run timeout (default: 300000 / 5 min)

**`packages/web`**:
- `VITE_CONVEX_URL` — Convex deployment URL
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth key
