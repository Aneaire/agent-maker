# Deployment Guide

## Overview

Agent Maker has 3 services to deploy:

| Service | Package | What it does |
|---------|---------|--------------|
| **Convex Backend** | `packages/shared` | Database, auth, serverless functions |
| **Agent Server** | `packages/agent` | Processes agent jobs, runs tools, handles automations |
| **Web UI** | `packages/web` | React frontend |

## Prerequisites

- Convex account with a production deployment
- Clerk account with production keys
- A server/platform for the agent server (Fly.io, Railway, Render, VPS, etc.)
- A hosting platform for the web UI (Vercel, Netlify, Cloudflare Pages, etc.)

## Step 1: Deploy the Agent Server

The agent server is a Node.js/Bun HTTP server that must be **publicly accessible** so Convex cloud can reach it for push-based dispatch (automations, timers, schedules).

### Platform Options

**Fly.io** (recommended):
```bash
cd packages/agent
fly launch
fly secrets set CONVEX_URL=https://your-deployment.convex.cloud
fly secrets set AGENT_SERVER_TOKEN=your-secret-token
fly secrets set PORT=4000
fly secrets set GEMINI_API_KEY=your-key  # if using RAG/image gen
fly secrets set CREDENTIAL_ENCRYPTION_KEY=your-key  # if using credentials
```

**Railway / Render / Any Docker host:**
```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 4000
CMD ["bun", "run", "packages/agent/src/server.ts"]
```

### Required Environment Variables

| Variable | Value |
|----------|-------|
| `CONVEX_URL` | Your Convex production deployment URL |
| `AGENT_SERVER_TOKEN` | A secure random string (shared with Convex) |
| `PORT` | `4000` (or any port your platform exposes) |
| `GEMINI_API_KEY` | Google Gemini key (if using RAG or image generation) |
| `CREDENTIAL_ENCRYPTION_KEY` | AES-256 key for credential encryption |

### Verify

```bash
curl https://your-agent-server.fly.dev/health
# Should return: {"status":"ok","active":0,"queued":0}
```

## Step 2: Deploy Convex Backend

### Set Production Environment Variables

```bash
cd packages/shared

# Auth
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-domain.clerk.accounts.dev

# Agent server connection (CRITICAL — must be your deployed agent server URL)
npx convex env set AGENT_SERVER_TOKEN your-secret-token
npx convex env set AGENT_SERVER_URL https://your-agent-server.fly.dev

# Credential encryption
npx convex env set CREDENTIAL_ENCRYPTION_KEY your-encryption-key
```

> **CRITICAL:** `AGENT_SERVER_URL` must point to your **publicly accessible** agent server. Without this, automations, scheduled actions, and timers will silently fail. During local development it defaults to `http://localhost:4000`, but Convex cloud cannot reach localhost.

### Deploy

```bash
cd packages/shared
npx convex deploy --env-file ../../.env
```

### Verify

Check the Convex dashboard at https://dashboard.convex.dev — your functions should be listed and the deployment should be active.

## Step 3: Deploy the Web UI

The web UI is a React Router 7 app. Deploy to any static/SSR hosting platform.

### Vercel

```bash
cd packages/web
vercel --prod
```

### Environment Variables

Set these in your hosting platform's dashboard:

| Variable | Value |
|----------|-------|
| `VITE_CONVEX_URL` | Your Convex production deployment URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk **production** publishable key |
| `VITE_AGENT_SERVER_URL` | Your deployed agent server URL (e.g., `https://your-agent-server.fly.dev`) |

## Environment Variable Summary

### Root `.env` (local development)

```bash
# Convex
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=dev:your-key
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Clerk
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Agent Server
PORT=4000
AGENT_SERVER_TOKEN=your-secret-token
AGENT_SERVER_URL=http://localhost:4000
VITE_AGENT_SERVER_URL=http://localhost:4000

# Optional
GEMINI_API_KEY=your-key
CREDENTIAL_ENCRYPTION_KEY=your-key
```

### Production Differences

| Variable | Local | Production |
|----------|-------|------------|
| `AGENT_SERVER_URL` | `http://localhost:4000` | `https://your-agent-server.fly.dev` |
| `VITE_AGENT_SERVER_URL` | `http://localhost:4000` | `https://your-agent-server.fly.dev` |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `CLERK_JWT_ISSUER_DOMAIN` | Test domain | Production domain |

## Post-Deployment Checklist

- [ ] Agent server health check returns `{"status":"ok"}`
- [ ] Convex dashboard shows all functions deployed
- [ ] Web UI loads and Clerk login works
- [ ] Can create a new agent via the creator flow
- [ ] Can send a message and receive an AI response
- [ ] Can create a task and see automation fire (check agent events in workflow page)
- [ ] Scheduled actions fire at the correct time
- [ ] Timers fire after their delay period

## Troubleshooting

### Automations/timers/schedules don't fire

**Cause:** `AGENT_SERVER_URL` is not set or points to localhost in the Convex cloud environment.

**Fix:**
```bash
npx convex env set AGENT_SERVER_URL https://your-agent-server.fly.dev
```

### Agent doesn't respond to messages

**Cause:** Agent server is down or can't reach Convex.

**Check:**
1. Agent server health: `curl https://your-agent-server.fly.dev/health`
2. Agent server logs for connection errors
3. Verify `CONVEX_URL` and `AGENT_SERVER_TOKEN` are set correctly on the agent server

### Webhooks return errors in the UI

**Cause:** `VITE_AGENT_SERVER_URL` not set in web UI environment.

**Fix:** Set the env var in your hosting platform and redeploy the web UI.
