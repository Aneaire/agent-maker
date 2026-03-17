# Scheduled Actions

**Tool set name**: `schedules`
**Default**: Disabled

Create recurring or one-time scheduled tasks. Agents work autonomously without being prompted — checking APIs, sending reports, creating tasks on a schedule.

## Tools

| Tool | Description |
|------|-------------|
| `create_schedule` | Create a new scheduled action |
| `list_schedules` | List all schedules and their status |
| `pause_schedule` | Pause an active schedule |
| `resume_schedule` | Resume a paused schedule |
| `delete_schedule` | Delete a schedule permanently |

## Schedule Types

### Interval
Run on a fixed interval.

```
"every 5m"   — Every 5 minutes
"every 1h"   — Every hour
"every 1d"   — Every day
```

### Cron
Standard cron expressions for precise scheduling.

```
"0 9 * * 1"     — Every Monday at 9:00 AM
"0 */6 * * *"   — Every 6 hours
"30 17 * * 1-5" — Weekdays at 5:30 PM
```

### Once
Run a single time, then mark as completed.

## Action Types

Each schedule executes one of these actions when it fires:

| Action | Description | Config |
|--------|-------------|--------|
| `run_prompt` | Agent processes a prompt autonomously | `{ prompt: "Summarize today's tasks" }` |
| `send_email` | Send an email | `{ to, subject, body }` |
| `create_task` | Create a task on a page | `{ tabId, title, description, status, priority }` |
| `fire_webhook` | Send a POST to an external URL | `{ url, payload }` |

## How It Works

1. **Agent creates schedule** via `create_schedule` tool
2. **Server polls** for due schedules every 10 seconds
3. **Executor** runs the configured action
4. **Run is logged** in `scheduledActionRuns` with status, result, duration
5. **Next run** is computed based on schedule type
6. **Event emitted**: `schedule.fired` (can trigger automations)

## System Prompt Context

When schedules are enabled, the agent sees its active schedules in the system prompt:
```
## Active Schedules
- "Daily report" — every 1d [active]
- "API health check" — every 5m [active]
```

The agent also receives scheduling guidance:
> When the user says "remind me", "every day", "check daily", "follow up in", etc., use the appropriate scheduling tool.

## Example Usage

### Daily Report
**User**: "Send me a daily summary of open tasks every morning at 9am"

**Agent** creates:
```
Name: "Daily task summary"
Schedule: "0 9 * * *" (cron)
Action: send_email { to: "user@example.com", subject: "Daily Task Summary", body: "..." }
```

### API Health Check
**User**: "Check if our API is up every 5 minutes"

**Agent** creates:
```
Name: "API health check"
Schedule: "every 5m" (interval)
Action: fire_webhook { url: "https://api.example.com/health", payload: {} }
```

### One-Time Reminder
**User**: "Remind me to review the PR tomorrow"

**Agent** creates:
```
Name: "PR review reminder"
Schedule type: once
Action: run_prompt { prompt: "Remind the user to review the pending PR" }
```

## Integration with Other Tools

- **Email**: Schedules can send emails on a recurring basis
- **Webhooks**: Schedules can fire webhooks to external services
- **Tasks**: Schedules can create tasks automatically
- **Automations**: The `schedule.fired` event can trigger automation chains
- **Event Bus**: Every schedule execution is logged as an event

## Limits

| Limit | Value |
|-------|-------|
| Schedules per agent | 20 |
| Minimum interval | Configurable (no hard minimum) |
| Max runs | Optional (unlimited by default) |
| Poll interval | 10 seconds |
