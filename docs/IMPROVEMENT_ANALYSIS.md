# Agent Maker: Application Analysis & Improvement Opportunities

## Current Application Overview

**Agent Maker** is a sophisticated AI agent management platform that allows users to create, configure, and interact with custom Claude-powered agents. It's a **full-stack monorepo** with three interconnected packages.

### What It Does

1. **Agent Creation** — Conversational creator flow with starter templates (Customer Support, Research Assistant, Project Manager, Writing Assistant, Data Analyst)
2. **Agent Management** — Dashboard to create, edit, enable/disable agents; configure tools, models, and capabilities
3. **Multi-Agent Chat** — Real-time chat interface with agents that can autonomously create pages, store memories, search the web, call APIs
4. **Workspace Pages** — Task boards, note collections, spreadsheets, markdown documents that agents autonomously manage
5. **Automations & Scheduling** — Event-driven workflows, cron jobs, timers, webhooks
6. **Multi-Model Support** — Claude (Sonnet 4.6 default, Opus 4.6, Haiku 4.5) + Gemini integration
7. **Advanced Tools** — Memory system, web search, page creation, email, RAG, custom HTTP tools, Notion, Slack, Google integrations

### Architecture at a Glance

```
Web UI (React 19 + Router)
    ↓
Convex Backend (Database + Serverless Functions)
    ↓
Agent Server (Hono + Claude Agent SDK + MCP Tools)
```

- **Push-based dispatch** for jobs/timers/schedules via Convex's scheduler (sub-second latency)
- **Fallback polling** every 30s for safety
- **Event bus** drives automations, webhooks, and workflow triggering
- **MCP tool server** dynamically registers 20+ tool sets based on agent config
- **Clerk authentication** for users + server token for internal auth

---

## Strengths & What's Working Well

1. **Flexible Tool Architecture** — Tools are gated by `enabledToolSets`, allowing users to customize agent capabilities without bloat
2. **Event-Driven Automations** — Task creation → email → webhook → schedule creates powerful workflow chains
3. **Native Convex Scheduling** — Moved automation/schedule execution inside Convex (no HTTP to agent server), reducing latency and complexity
4. **Real-Time UI** — Convex React subscriptions keep the UI synchronized with backend state
5. **Sandbox Seed System** — Registry-based test data seeding for rapid testing without editing seed code
6. **Clear Code Organization** — CLAUDE.md documents every checklist for adding features; AGENTS.md stays identical for agent knowledge
7. **Multi-Model Support** — Abstracts Claude vs. Gemini routing, letting users pick their preferred model
8. **Starter Templates** — Reduces friction; users don't start from blank slate
9. **Plan Tiers** — Free → Pro → Enterprise with clear feature gates (max agents, pages, postgres, etc.)

---

## Pain Points & Improvement Opportunities

### 1. **Job Claiming Contention Under Load**
**Problem:** Multiple agent server instances competing to claim the same job. No distributed lock or queue mechanism — just "first one to write `jobClaimed = true` wins."

**Impact:**
- Under high load (many agents, many jobs), this could lead to race conditions
- If job claiming fails, fallback is polling every 30s (slow)
- No visibility into failed job claims

**Improvement Ideas:**
- Implement a proper distributed lock (Convex-level atomic lease system or Redis)
- Add job claim metrics/observability
- Implement exponential backoff for job polling
- Consider a job priority queue (high-priority jobs polled more frequently)

---

### 2. **Limited Observability & Debugging**
**Problem:** No centralized logging dashboard, tracing, or error tracking. Agent failures are hard to diagnose.

**Impact:**
- Users don't know why an agent run failed
- Debugging multi-step automations is opaque
- No performance metrics (response time, token usage, cost estimates)

**Improvement Ideas:**
- Add structured logging to `agentJobs` table (error logs, trace IDs, LLM token usage)
- Build an **Agent Debug Dashboard** showing:
  - Job execution timeline with tool calls
  - Token usage per job
  - Cost estimates per agent run
  - Error logs + stack traces
  - System prompt used for that job
- Export logs to external APM (Datadog, New Relic, etc.)
- Add job retry logic with exponential backoff

---

### 3. **Agent Memory Scaling Issues**
**Problem:** `recall_memory` is a full-text search with no pruning. As memory grows, search becomes slow and context window bloat increases.

**Impact:**
- Agents at scale will waste tokens on irrelevant old memories
- No built-in memory cleanup or archival strategy
- Memory searchability degrades over time

**Improvement Ideas:**
- **Vector embeddings for memory** — Store embeddings, use semantic search instead of full-text
- **Automated memory pruning** — Archive or delete old memories based on age/relevance scores
- **Memory categorization** — Let agents organize memories (project-specific, general knowledge, preferences) and search within categories
- **Token budget awareness** — Memory tool should estimate tokens before returning results
- **Memory summarization** — Periodically summarize old memories into abstract summaries

---

### 4. **No Inter-Agent Communication Protocol**
**Problem:** `agent_messages` tool exists but is minimal. No request/response pattern, no context sharing, no way for agents to wait for other agents.

**Impact:**
- Agents can't collaborate on complex tasks
- No agent-to-agent workflow (e.g., "Research Agent → Summarizer Agent → Editor Agent")
- Difficult to build multi-agent systems

**Improvement Ideas:**
- **Agent-to-Agent RPC** — Implement synchronous agent calls with request/response pattern
- **Agent Pools** — Create "agent groups" that can collaborate (e.g., research team with different specialties)
- **Message Threading** — Allow agents to hold conversations with each other in shared threads
- **Context Passing** — Agents should be able to pass rich context objects (memories, file references, etc.)

---

### 5. **RAG System Fragmentation**
**Problem:** RAG documents are stored but there's no versioning, no document lifecycle (draft → published → archived), and no way to manage document permissions or relevance.

**Impact:**
- Users can't control which documents agents see
- No audit trail for document changes
- Stale documents pollute search results

**Improvement Ideas:**
- **Document Versioning** — Track versions with diffs, rollback capability
- **Document Lifecycle** — Draft → Published → Archived states
- **Smart RAG Filtering** — Let users tag documents, create RAG "collections," control agent access per collection
- **Relevance Feedback** — After agent uses a document, let users rate whether it was useful (train reranking model)
- **Hybrid Search** — Combine semantic search with traditional BM25/TF-IDF for better recall

---

### 6. **Page Types Are Isolated Islands**
**Problem:** Tasks, Notes, Spreadsheets, and API endpoints don't interconnect. An agent can't link a task to a note, or query across page types.

**Impact:**
- Users have fragmented data; can't see the full picture
- Agents can't build cross-page workflows (e.g., "Create tasks for each row in the spreadsheet")
- No way to create rich dashboards or reports

**Improvement Ideas:**
- **Cross-Page Linking** — Tasks can link to notes, notes can embed spreadsheet data
- **Unified Query Language** — Allow agents to query/filter across all page types (like SQL but agent-friendly)
- **Smart Page Synthesis** — Auto-generate summary pages (dashboards) from other pages
- **Page Templates** — Let users define multi-page structures (Project Template = Tasks + Notes + Timeline)

---

### 7. **Weak API Endpoint Versioning & Governance**
**Problem:** REST API endpoints (`tabApiEndpoints`) have no versioning, rate limiting, or usage tracking. Users can break integrations without realizing.

**Impact:**
- Breaking changes to endpoints can silently break downstream systems
- No way to deprecate endpoints gracefully
- No API usage insights

**Improvement Ideas:**
- **API Versioning** — Support v1, v2, v3 endpoints; deprecation period before removal
- **Rate Limiting & Quotas** — Per-API-key limits, usage monitoring
- **API Documentation Auto-Generation** — Generate OpenAPI/Swagger specs from endpoint configs
- **Webhook Replay** — When an endpoint schema changes, allow replaying recent webhook payloads to new endpoint
- **API Analytics** — Track usage, latency, error rates per endpoint

---

### 8. **Credential Management Is a Single Point of Failure**
**Problem:** All agent credentials are encrypted in one central table. One breach = all credentials compromised. No credential rotation, expiration, or scoping.

**Impact:**
- Credentials persist indefinitely; no way to audit who accessed what
- Can't rotate credentials without updating agent configs
- Can't scope credentials to specific agents or tools

**Improvement Ideas:**
- **Credential Scoping** — Credentials should be scoped to agent + tool combinations
- **Expiration Policies** — Auto-rotate credentials on a schedule
- **Audit Logging** — Track when credentials are created, accessed, rotated, deleted
- **Credential Secrets Scanning** — Check for accidentally committed secrets in automations/prompts
- **Vault Integration** — Support HashiCorp Vault, AWS Secrets Manager, or Google Secret Manager for enterprise

---

### 9. **No A/B Testing or Experimentation Framework**
**Problem:** Users can't test different system prompts, tool configurations, or models side-by-side. Agent changes are binary (current vs. new).

**Impact:**
- No way to optimize agents empirically
- Hard to measure if a change is better
- No built-in feedback loop for agent improvement

**Improvement Ideas:**
- **Agent Variants** — Create A/B test variants of an agent with different prompts/tools/models
- **Metrics & Feedback** — Collect structured feedback on agent responses (thumbs up/down, custom scoring)
- **Statistical Significance** — Run experiments and detect winners at p<0.05
- **Prompt Optimization** — Auto-suggest prompt improvements based on user feedback
- **Cost-Quality Tradeoff** — Show cost per response vs. quality score; help users find sweet spot

---

### 10. **Limited Batch Processing & Async Workflows**
**Problem:** Each agent run is a single request. If you want to process 1000 tasks, it's 1000 separate jobs.

**Impact:**
- Inefficient for bulk operations
- No way to pipeline work (e.g., async task processing with callbacks)
- Users can't leverage agent throughput efficiently

**Improvement Ideas:**
- **Batch Job API** — Accept arrays of tasks; agent processes them in one run with better context
- **Async Callbacks** — Jobs can call webhooks when done, enabling chaining
- **Agent Queues** — Create named work queues; agents pull from queues and process in batches
- **Pipeline Primitives** — Map/reduce workflows; fan-out/fan-in patterns
- **Dead Letter Queue** — Failed batch items go to DLQ for manual review

---

### 11. **Landing Page Lacks Product Clarity**
**Problem:** The landing page is visually impressive (3D logo, integration network) but doesn't clearly articulate:
- Who this is for (developers? non-technical users? enterprises?)
- What problems it solves vs. existing tools
- ROI / why someone should choose Agent Maker over alternatives

**Impact:**
- High bounce rate for unclear product
- Unclear positioning vs. competitors (e.g., OpenAI Assistants, LangChain, Vercel AI)

**Improvement Ideas:**
- **Clear Value Prop** — 3-4 sentence headline answering: "What is Agent Maker & who is it for?"
- **Problem/Solution Framework** — "Before: X problem | After: Agent Maker solution"
- **Use Case Carousel** — Show real workflows (Customer Support Agent saves 10 hours/week, etc.)
- **Comparison Table** — Agent Maker vs. OpenAI Assistants vs. LangChain (features, pricing, ease of use)
- **Social Proof** — Case studies, testimonials, user counts
- **CTAs Aligned to Segment** — "For Developers" → docs | "For Enterprises" → book demo

---

### 12. **Model Routing Logic Is Brittle**
**Problem:** `isGeminiModel()` checks the model ID string. If a new model is added, it's easy to forget Gemini routing.

**Impact:**
- Adding new models is error-prone
- Code duplication between Claude and Gemini code paths
- Hard to add new model families (LLaMA, Grok, etc.)

**Improvement Ideas:**
- **Model Registry** — Centralized registry with metadata (vendor, max_tokens, context_window, cost per token, etc.)
- **Model Plugin System** — Let users add custom models via plugins
- **Capability Matrix** — Declare which models support which features (tools, vision, function calling)
- **Cost Optimization** — Auto-select cheapest model that meets requirements
- **Model Deprecation** — Gracefully retire old models with migration support

---

### 13. **Creator Session UX Could Be Smoother**
**Problem:** Creator sessions are stored but there's no progress indicator, draft saving, or way to resume interrupted creation flows.

**Impact:**
- User has to start over if they refresh or navigate away mid-creation
- No indication of where they are in the flow
- Discourages completing creation

**Improvement Ideas:**
- **Auto-Save Drafts** — Save progress to DB every 5 seconds
- **Progress Indicator** — "Step 2 of 6: Name your agent"
- **Resume Prompt** — "You have a draft agent from 2 hours ago. Resume?"
- **Inline Validation** — Real-time feedback (name too long, emoji invalid, etc.)
- **Preview as You Go** — Show a live preview panel of the agent being created
- **Skip Optional Steps** — Not every field should be required (description, icon, etc.)

---

### 14. **No Built-In Monitoring or SLAs**
**Problem:** Agent Maker doesn't track uptime, latency, or error rates. Users have no visibility into agent reliability.

**Impact:**
- Users don't know if an agent is flaky
- Hard to debug recurring issues
- No SLA guarantees

**Improvement Ideas:**
- **Agent Health Dashboard** — Show uptime, avg response time, error rate
- **Alerts** — Notify users when error rate exceeds threshold
- **Status Page** — Public/private status page showing agent health
- **Load Testing** — Built-in load testing tool to stress-test agents before production
- **Graceful Degradation** — If a tool fails (e.g., email service down), agent should know and handle gracefully

---

### 15. **Lack of Security Posture Visibility**
**Problem:** No built-in security scanning, no warnings if agents have risky configurations, no RBAC beyond Clerk (all users in a workspace have equal access).

**Impact:**
- Users might accidentally expose sensitive data
- No audit trail of who did what
- Enterprise customers can't enforce governance

**Improvement Ideas:**
- **Security Advisor** — Scan agent configs and warn about risky patterns (exposed credentials, overly permissive tools, etc.)
- **Audit Logs** — Full audit trail of all mutations (agent changes, credential access, runs, etc.)
- **RBAC** — Roles: Owner, Admin, Editor, Viewer with granular permissions
- **Data Governance** — DLP (Data Loss Prevention) scanning on agent outputs
- **Compliance Reports** — Generate SOC 2, HIPAA, GDPR compliance reports
- **Sandbox Isolation** — Run agents in isolated containers to prevent cross-agent interference

---

## Quick Wins (1-2 Week Sprints)

1. **Add job execution logging** — Log errors/token usage to `agentJobs`, surface in UI
2. **Create Agent Debug Dashboard** — Show job timeline, tool calls, token usage, errors
3. **Implement memory search metrics** — Track memory size, search latency; warn if bloated
4. **Add landing page comparison table** — Agent Maker vs. competitors (5 key differentiators)
5. **Credential rotation reminder** — Prompt users to rotate credentials every 90 days
6. **API endpoint usage stats** — Show request count, latency, error rate per endpoint
7. **Batch job API** — Support `POST /api/{agentId}/batch` with array of tasks
8. **Experiment metrics** — Collect thumbs up/down on agent responses; show feedback % in UI

---

## Strategic Initiatives (1-3 Month Projects)

1. **Observability Platform** — Structured logging, traces, metrics, APM integration
2. **Agent Collaboration Layer** — RPC protocol, agent-to-agent messaging, pool management
3. **Vector Memory System** — Semantic search + pruning + categorization
4. **Cross-Page Linking** — Query across pages, unified search, smart dashboards
5. **Enterprise Security** — Audit logs, RBAC, credential scoping, DLP scanning
6. **Model Marketplace** — Community models, model A/B testing, cost optimization
7. **Landing Page Rewrite** — Clear positioning, use cases, comparison, social proof
8. **Workflow Builder UI** — Visual editor for automations/schedules (not just JSON config)

---

## Competitive Differentiation Opportunities

1. **Agent Memory That Actually Works** — Vector embeddings + pruning + semantic search (vs. naive RAG competitors)
2. **Native Multi-Agent Collaboration** — Built-in agent-to-agent RPC (vs. single-agent systems)
3. **Event-Driven Workflows** — Automations triggered by agent actions (vs. cron-only competitors)
4. **Observability First** — Debug agent runs as easily as you debug code (vs. black box competitors)
5. **Cost Optimization** — Auto-select cheapest model that meets quality threshold (vs. fixed model competitors)

---

## Conclusion

Agent Maker is a **well-architected, feature-rich platform** with solid fundamentals (event bus, multi-model support, automation engine). The biggest gaps are:

1. **Visibility** (observability, debugging, metrics)
2. **Scalability** (distributed job claiming, batch processing, memory management)
3. **Collaboration** (agent-to-agent communication, shared contexts)
4. **Security** (audit logs, RBAC, credential governance)
5. **Clarity** (landing page messaging, use case focus)

The most impactful improvements would be **observability dashboard** (enables better debugging, user retention) and **agent collaboration** (enables multi-agent workflows, differentiates from competitors).
