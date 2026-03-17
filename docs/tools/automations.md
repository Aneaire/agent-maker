# Automations

**Tool set name**: `automations`
**Default**: Disabled

Create event-driven rules: when something happens, automatically do something else. Chain multiple actions together for complex workflows.

## Tools

| Tool | Description |
|------|-------------|
| `create_automation` | Create a new automation rule |
| `list_automations` | List all automation rules |
| `delete_automation` | Delete an automation |

## Concept

An automation has:
- **Trigger**: An event + optional filter conditions
- **Actions**: One or more actions to execute in order

```
WHEN task.updated (filter: status = "done")
  → send_email to team@company.com
  → create_note with summary
  → fire_webhook to Slack
```

## Trigger Events

Any event in the event bus can trigger an automation:

| Event | Fired When |
|-------|------------|
| `task.created` | A task is created (via tool or webhook) |
| `task.updated` | A task is updated |
| `task.deleted` | A task is deleted |
| `note.created` | A note is created |
| `note.updated` | A note is updated |
| `email.sent` | An email is sent successfully |
| `email.failed` | An email fails to send |
| `webhook.received` | An incoming webhook is received |
| `webhook.fired` | An outgoing webhook is fired |
| `schedule.fired` | A scheduled action executes |
| `timer.fired` | A timer fires |
| `memory.stored` | A memory is stored |
| `document.ready` | A document finishes processing |
| `agent_message.received` | A message from another agent arrives |
| `agent_message.sent` | A message is sent to another agent |

## Trigger Filters

Narrow when an automation runs by filtering event payload fields:

```json
{
  "status": "done",
  "priority": "high"
}
```

Only events where **all** filter conditions match will trigger the automation.

## Actions

Actions execute in order. Available action types:

| Action | Config | Description |
|--------|--------|-------------|
| `send_email` | `{ to, subject, body }` | Send an email |
| `create_task` | `{ tabId, title, description, status, priority }` | Create a task |
| `update_task` | `{ taskId, status, priority }` | Update a task |
| `create_note` | `{ tabId, title, content }` | Create a note |
| `fire_webhook` | `{ url, payload }` | Fire an outgoing webhook |
| `store_memory` | `{ content, category }` | Store a memory |
| `run_prompt` | `{ prompt }` | Have the agent process a prompt |
| `trigger_agent` | `{ agentId, message }` | Send a message to another agent |
| `delay` | `{ ms }` | Wait before the next action (max 1 hour) |

## Template Variables

Action configs support template variables that reference the triggering event's payload:

```
{{event.title}}       → Task title
{{event.status}}      → Task status
{{event.description}} → Task description
{{event.priority}}    → Task priority
```

### Example

```json
{
  "trigger": { "event": "task.updated", "filter": { "status": "done" } },
  "actions": [
    {
      "type": "send_email",
      "config": {
        "to": "team@company.com",
        "subject": "Task completed: {{event.title}}",
        "body": "The task '{{event.title}}' has been marked as done."
      }
    },
    {
      "type": "fire_webhook",
      "config": {
        "url": "https://hooks.slack.com/services/xxx",
        "payload": { "text": "Task done: {{event.title}}" }
      }
    }
  ]
}
```

## Example Use Cases

### Task Completion Notifier
> "When a task is marked done, email the team and post to Slack"

### Support Ticket Router
> "When a webhook is received, create a task and notify the support agent"

### Daily Digest Pipeline
> "When the daily schedule fires, create a summary note"

### Escalation Chain
> "When a high-priority task is created, email the manager and wait 30 minutes, then create a follow-up task if not assigned"

```json
{
  "trigger": { "event": "task.created", "filter": { "priority": "high" } },
  "actions": [
    { "type": "send_email", "config": { "to": "manager@co.com", "subject": "High priority: {{event.title}}" } },
    { "type": "delay", "config": { "ms": 1800000 } },
    { "type": "create_task", "config": { "tabId": "...", "title": "Follow up: {{event.title}}", "priority": "high" } }
  ]
}
```

## System Prompt Context

When automations are enabled, the agent sees active automations in its context:
```
## Active Automations
- "Task completion notifier" — triggers on: task.updated
- "Support ticket router" — triggers on: webhook.received
```

## Limits

| Limit | Value |
|-------|-------|
| Automations per agent | 30 |
| Actions per automation | 10 |
| Max delay | 1 hour (3,600,000ms) |
