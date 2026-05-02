# Infrastructure

## Domain

- **Domain:** higantic.com
- **Admin site:** admin.hometownroofingtx.com

## Hosting

| Service | Platform | Notes |
|---------|----------|-------|
| **Web UI** | Vercel | `packages/web` — React Router 7 app deployed to Vercel at higantic.com |
| **Admin Site** | Vercel | `packages/admin` — deployed at admin.hometownroofingtx.com |
| **Convex Backend** | Convex Cloud | `packages/shared` — managed by Convex |
| **Agent Server** | TBD | `packages/agent` — must be publicly accessible for Convex push dispatch |

## DNS

- Main domain managed via Vercel: https://higantic.com
- Admin subdomain: https://admin.hometownroofingtx.com

## Vercel Project

- Framework: React Router 7
- Build command: default (from `packages/web`)
- Environment variables: `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_AGENT_SERVER_URL`
- See `docs/advanced/deployment.md` for full env var reference
