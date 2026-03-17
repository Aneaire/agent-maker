# Environment Variables

## packages/agent (Agent Server)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CONVEX_URL` | Yes | — | Convex deployment URL |
| `AGENT_SERVER_TOKEN` | Yes | — | Shared secret for server-to-Convex auth |
| `PORT` | No | `3001` | Agent server port |
| `POLL_INTERVAL_MS` | No | `2000` | Job polling interval in ms |
| `SCHEDULE_POLL_MS` | No | `10000` | Scheduled action polling interval in ms |
| `TIMER_POLL_MS` | No | `5000` | Timer polling interval in ms |
| `MAX_CONCURRENT_AGENTS` | No | `20` | Max concurrent agent runs |
| `AGENT_TIMEOUT_MS` | No | `300000` | Per-run timeout (5 min default) |
| `GEMINI_API_KEY` | For RAG | — | Google Gemini API key for document embeddings |

## packages/shared (Convex Backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_SERVER_TOKEN` | Yes | Must match the agent server's token |

Convex deployment URL is auto-configured by `convex dev`.

## packages/web (Web UI)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk authentication publishable key |

## Per-Agent Configuration (Stored in DB)

These are configured per-agent in the Settings UI, not as environment variables:

| Config | Tool Set | Fields |
|--------|----------|--------|
| Email | `email` | `resendApiKey`, `fromEmail`, `fromName` |
| PostgreSQL | `postgres` | `connectionString` |
| Custom HTTP | `custom_http_tools` | `name`, `endpoint`, `method`, `headers`, `inputSchema` |
