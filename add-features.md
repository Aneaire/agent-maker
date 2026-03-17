# Agent Maker - New Features Roadmap

## Current Tool Sets

- **Memory** — store/recall/search
- **Web Search** — search + fetch
- **Pages** — tasks, notes, spreadsheets, markdown, data tables
- **Custom HTTP Tools** — user-defined API calls
- **PostgreSQL** (Pro+)
- **REST API Endpoints** (Pro+)
- **Suggest Replies / Ask Questions** — always-on UX

---

## New Tools

### High-Impact / Low Complexity

1. **Email Tools** — Send emails (via Resend/SendGrid), read inbox summaries. Huge for support & PM agents.
2. **Scheduled Actions / Cron** — "Remind me every Monday" or "Check this API daily." Agents that work without being prompted.
3. **File Generation** — Generate PDFs, CSVs, or images that users can download. Natural fit for data analyst and writing agents.
4. **Code Execution (Sandbox)** — Run Python/JS snippets in a sandboxed environment. Transforms data analyst agents from "describe" to "compute."
5. **Slack/Discord Integration** — Post messages, read channels. Makes agents usable in team workflows.

### Medium Complexity / High Value

6. **Webhook Triggers** — Agents that activate on incoming webhooks (e.g., Stripe payment → agent processes it). Moves from reactive to event-driven.
7. **Vector Search / RAG** — Upload documents (PDF, DOCX), chunk and embed them, then let agents search over them. Critical for knowledge-base agents.
8. **Google Sheets / Calendar Integration** — Read/write Google Sheets, create calendar events. Practical for PM and analyst agents.
9. **Image Analysis** — Accept image uploads in chat and use Claude's vision. Useful for support (screenshot analysis) and research agents.
10. **Multi-Agent Handoff** — One agent delegates to another. E.g., a "router" agent hands off to specialized sub-agents.

### Differentiators (Pro/Enterprise)

11. **Workflow / Multi-Step Pipelines** — Define sequences: "When a task is marked done → summarize in notes → send Slack message." Visual or prompt-based.
12. **Form Builder** — Agents create embeddable forms (lead capture, surveys) that feed data into their pages.
13. **Database Write (Postgres)** — Currently read-only. Allowing writes (with guardrails) enables agents to manage external data.
14. **OAuth Connections** — Let users connect their own Google, GitHub, Notion, etc. accounts so agents act on their behalf.
15. **Analytics / Dashboard Tools** — Agents generate charts/visualizations from their data tables or external sources.

### Quick Wins

16. **Timer/Delay Tool** — "Wait 5 minutes then follow up." Simple but enables drip sequences.
17. **Clipboard / Export Tool** — Format and copy structured data to clipboard or export as JSON.
18. **Math / Calculator Tool** — Reliable arithmetic without hallucination risk.
19. **QR Code Generator** — Simple utility, useful for API/link-heavy agents.
20. **URL Shortener** — Pairs well with API and marketing agents.

---

## Recommended Priorities

| Priority | Tool                          | Why                                                  |
| -------- | ----------------------------- | ---------------------------------------------------- |
| 1        | **Scheduled Actions**         | Makes agents autonomous — biggest differentiator     |
| 2        | **File/Document Upload + RAG**| Every support/research agent needs this              |
| 3        | **Email Tools**               | Bridges agents to real-world communication           |
| 4        | **Code Execution Sandbox**    | Makes data agents actually useful                    |
| 5        | **Webhook Triggers**          | Enables event-driven agents (huge for Pro/Enterprise)|
