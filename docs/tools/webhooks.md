# Webhooks

**Tool set name**: `webhooks`
**Default**: Disabled

Send and receive webhooks to integrate with external services — Slack, Discord, Zapier, n8n, Make, and any system that speaks HTTP.

## Tools

| Tool | Description |
|------|-------------|
| `fire_webhook` | Send a POST request to any URL |
| `list_events` | View recent events in the event bus |

## Two Types of Webhooks

### Outgoing (Agent → External)
The agent fires webhooks to external URLs on demand or via automations/schedules.

**Agent tool**: `fire_webhook`
```
URL: https://hooks.slack.com/services/xxx
Payload: { "text": "New task created: Fix login bug" }
Event name: "task.notification" (optional)
```

### Incoming (External → Agent)
External services send webhooks to your agent to create tasks, trigger automations, or pass data.

**Endpoint**: `POST /webhook/:secret`

Each incoming webhook has a unique secret (format: `whk_xxxxx`). Configure them in the Tasks page webhook settings.

#### Incoming Webhook Payload

```json
{
  "action": "create",
  "title": "New support ticket",
  "description": "User reports login issue",
  "status": "todo",
  "priority": "high"
}
```

**Supported actions**:
- `create` — Create a new task (requires `title`)
- `update` — Update a task (requires `taskId`)

## Webhook Configuration (UI)

In any Tasks page, click the webhook icon to manage webhooks:

1. **Add Incoming Webhook** — Get a secret URL to receive data from external services
2. **Add Outgoing Webhook** — Set a URL + events to forward task changes
3. **Toggle** — Enable/disable individual webhooks
4. **Events** — Choose which events trigger outgoing webhooks

### Outgoing Webhook Events

| Event | Fires When |
|-------|------------|
| `task.created` | A task is added to the board |
| `task.updated` | A task is modified |
| `task.deleted` | A task is removed |

### Outgoing Webhook Payload Format

```json
{
  "event": "task.created",
  "timestamp": "2026-03-17T10:30:00.000Z",
  "data": {
    "taskId": "abc123",
    "title": "Fix login bug",
    "status": "todo",
    "priority": "high"
  }
}
```

## Event Bus Integration

When webhooks are enabled, the agent can view event history via `list_events`. Every tool action across the system emits events:

```
[2026-03-17T10:30:00Z] task.created (page_tools): {"title":"Fix bug"...}
[2026-03-17T10:29:00Z] email.sent (email_tools): {"to":"user@co.com"...}
[2026-03-17T10:28:00Z] schedule.fired (scheduler): {"actionName":"Daily check"...}
```

## Example Integrations

### Slack Notifications
```
fire_webhook:
  URL: https://hooks.slack.com/services/T00/B00/xxx
  Payload: { "text": "Agent update: Task completed!" }
```

### Zapier / Make Trigger
Set up an incoming webhook, get the secret URL, and configure Zapier/Make to POST to it. Tasks will be created automatically.

### n8n Workflow
Fire outgoing webhooks to n8n webhook nodes. n8n processes the data and can call back via incoming webhooks.

### GitHub Actions
Fire webhooks to trigger GitHub Actions workflows via repository dispatch.

## Limits

| Limit | Value |
|-------|-------|
| Webhooks per page | 10 |
| Webhook timeout | 15 seconds |
| Secret format | `whk_` + 32 random chars |
