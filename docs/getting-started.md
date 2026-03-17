# Quick Start Guide

Create your first AI agent in 5 minutes.

## 1. Create an Agent

Navigate to `/agents/new`. The Creator Agent will walk you through setup:

1. **Choose a path**: Pick a starter template or build from scratch
2. **Name & purpose**: Give your agent a name and describe what it does
3. **Configure tools**: Enable the capabilities your agent needs
4. **Set personality**: Customize the system prompt (or let the AI help)
5. **Finalize**: Your agent goes live on the dashboard

### Starter Templates

| Template | Best For | Includes |
|----------|----------|----------|
| Customer Support | Help desks, FAQ bots | Ticket tracking, Knowledge Base |
| Research Assistant | Research, analysis | Research Notes, Sources |
| Project Manager | Task tracking, deadlines | Project Tasks, Meeting Notes |
| Writing Assistant | Content creation | Drafts, Ideas |
| Data Analyst | Data organization | Data Tracker, Reports |

## 2. Enable Tool Sets

In your agent's **Settings** page, toggle the tool sets you need:

| Tool Set | What It Does |
|----------|-------------|
| Memory | Remember information across conversations |
| Web Search | Search the internet for current info |
| Pages | Create task boards, notes, spreadsheets |
| Email | Send emails via Resend |
| Knowledge Base | Search uploaded documents (PDF, DOCX) |
| Custom HTTP | Call any external API |
| Scheduled Actions | Run tasks on a schedule (cron) |
| Automations | Event-driven rules (when X → do Y) |
| Timers | Delayed actions and reminders |
| Webhooks | Send/receive webhooks |
| Inter-Agent Messaging | Agents talk to each other |

## 3. Chat with Your Agent

Go to your agent's chat and start a conversation. Your agent can:

- Answer questions using its knowledge and tools
- Create and manage pages (tasks, notes, spreadsheets)
- Search the web for current information
- Remember your preferences across conversations
- Set up schedules, automations, and more

## 4. Set Up Integrations

### Email
1. Go to Settings > Email
2. Add your Resend API key
3. Set a "from" email address
4. Your agent can now send emails

### Webhooks
1. Enable "Webhooks" in tool sets
2. Ask your agent to fire webhooks to external services
3. Or set up incoming webhooks in the Tasks page config

### Scheduled Actions
1. Enable "Scheduled Actions" in tool sets
2. Tell your agent: "Check this API every hour" or "Send me a daily summary"
3. The agent creates and manages the schedule

### Automations
1. Enable "Automations" in tool sets
2. Tell your agent: "When a task is completed, send me an email"
3. The agent creates the automation rule

## 5. Advanced Setup

### REST API (Pro+)
Expose your agent as an API endpoint. External services can send requests, and your agent processes them and returns structured responses.

### Multi-Agent Workflows
Enable "Inter-Agent Messaging" on multiple agents. One agent can delegate work to another — e.g., a router agent hands off to specialized sub-agents.

### Knowledge Base
Upload PDFs and documents in Settings. Your agent will chunk, embed, and search them to answer questions about their content.

---

Next: Read the individual tool documentation for detailed usage and examples.
