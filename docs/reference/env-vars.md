# Environment Variables

All env vars are set in the root `.env` file (loaded by each package via `--env-file=../../.env`).

## packages/agent (Agent Server)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CONVEX_URL` | Yes | — | Convex deployment URL |
| `AGENT_SERVER_TOKEN` | Yes | — | Shared secret for server-to-Convex auth |
| `PORT` | No | `3001` | Agent server port (set to `4000` in `.env`) |
| `POLL_INTERVAL_MS` | No | `30000` | Fallback poll interval in ms (primary dispatch is push-based) |
| `MAX_CONCURRENT_AGENTS` | No | `20` | Max concurrent agent runs |
| `AGENT_TIMEOUT_MS` | No | `300000` | Per-run timeout (5 min default) |
| `GEMINI_API_KEY` | For RAG | — | Google Gemini API key for document embeddings |
| `CREDENTIAL_ENCRYPTION_KEY` | For creds | — | AES-256 key for credential encryption |

## packages/shared (Convex Backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_SERVER_TOKEN` | Yes | Must match the agent server's token |
| `AGENT_SERVER_URL` | Yes* | Agent server URL for push dispatch (default: `http://localhost:3001`). **Must be set to a public URL in production** — see [deployment guide](../advanced/deployment.md) |

\* Required for automations, timers, and scheduled actions to work. Without it, these features silently fail.

Convex deployment URL is auto-configured by `convex dev`.

## packages/web (Web UI)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk authentication publishable key |
| `VITE_AGENT_SERVER_URL` | No | Agent server URL for webhook/API display in UI (default: auto-detect from hostname + port 3001) |

## Per-Agent Configuration (Stored in DB)

These are configured per-agent in the Settings UI, not as environment variables:

| Config | Tool Set | Fields |
|--------|----------|--------|
| Email | `email` | `resendApiKey`, `fromEmail`, `fromName` |
| PostgreSQL | `postgres` | `connectionString` |
| Custom HTTP | `custom_http_tools` | `name`, `endpoint`, `method`, `headers`, `inputSchema` |
