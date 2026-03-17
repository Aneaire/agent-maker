# Timers & Delays

**Tool set name**: `timers`
**Default**: Disabled

Set delayed actions — "do X after Y time." Useful for follow-ups, reminders, and drip sequences.

## Tools

| Tool | Description |
|------|-------------|
| `set_timer` | Schedule a delayed action |
| `list_timers` | List all active (waiting) timers |
| `cancel_timer` | Cancel a timer before it fires |

## How It Works

1. **Agent creates timer** with a delay and action
2. **Server polls** for due timers every 5 seconds
3. **Timer fires** and executes the configured action
4. **Event emitted**: `timer.fired` (can trigger automations)

## Timer vs Schedule

| Feature | Timer | Schedule |
|---------|-------|----------|
| Runs | Once | Recurring or once |
| Defined by | Delay from now | Cron or interval |
| Use case | "In 30 minutes..." | "Every Monday..." |
| Max duration | 30 days | Unlimited |

## Action Types

| Action | Config | Description |
|--------|--------|-------------|
| `send_message` | `{ content }` | Send a message in the conversation |
| `send_email` | `{ to, subject, body }` | Send an email |
| `create_task` | `{ tabId, title, description }` | Create a task |
| `fire_webhook` | `{ url, payload }` | Fire an outgoing webhook |
| `run_prompt` | `{ prompt }` | Agent processes a prompt |

## Example Usage

### Follow-up Reminder
**User**: "Remind me to check the deployment in 30 minutes"

**Agent** creates:
```
Label: "Check deployment"
Delay: 30 minutes
Action: send_message { content: "Reminder: Check the deployment status" }
```

### Drip Email Sequence
**User**: "Send a welcome email now, then a tips email in 2 hours"

**Agent**:
1. Sends welcome email immediately via `send_email`
2. Creates timer: 120 minutes, action: `send_email` with tips content

### Delayed Task Creation
**User**: "Create a review task for this PR tomorrow morning"

**Agent** creates:
```
Label: "PR review task"
Delay: 1440 minutes (24 hours)
Action: create_task { tabId: "...", title: "Review PR #42", priority: "high" }
```

## Limits

| Limit | Value |
|-------|-------|
| Active timers per agent | 50 |
| Maximum delay | 30 days |
| Poll interval | 5 seconds |
