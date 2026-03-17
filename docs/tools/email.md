# Email

**Tool set name**: `email`
**Default**: Disabled
**Requires**: Resend API key configuration

Send emails directly from your agent using the Resend API.

## Setup

1. Go to your agent's **Settings** page
2. Enable the **Email** tool set
3. Configure:
   - **Resend API Key** — Get one at [resend.com](https://resend.com)
   - **From Email** — The sender address (must be verified in Resend)
   - **From Name** (optional) — Display name for the sender

## Tools

| Tool | Description |
|------|-------------|
| `send_email` | Send an email to one or more recipients |

### send_email Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string or string[] | Yes | Recipient email address(es) |
| `subject` | string | Yes | Email subject line |
| `body` | string | Yes | HTML email body |
| `cc` | string[] | No | CC recipients |
| `bcc` | string[] | No | BCC recipients |
| `reply_to` | string | No | Reply-to address |

## Email Logging

Every email (sent or failed) is logged in the `emailLogs` table with:
- Recipient addresses
- Subject line
- Status (`sent` or `failed`)
- Resend message ID (on success)
- Error message (on failure)
- Timestamp

## Event Bus Integration

When email is used alongside **Automations**, the following events are emitted:
- `email.sent` — Email delivered successfully
- `email.failed` — Email delivery failed

These can trigger automations. For example: "When an email fails, create a task to follow up manually."

## Example Usage

**User**: "Send John a summary of today's meeting"

**Agent**: Composes an HTML email with the meeting summary and sends it via `send_email`.

```
To: john@example.com
Subject: Meeting Summary — March 17, 2026
Body: <h2>Meeting Summary</h2><ul><li>Discussed Q2 roadmap...</li></ul>
```

**User**: "Email the team about the new release"

**Agent**: Sends to multiple recipients with CC support.

## Using with Schedules

Combine email with **Scheduled Actions** to send recurring reports:

> "Send me a weekly summary every Monday at 9am"

The agent creates a schedule with `action_type: "send_email"` that fires weekly.

## Using with Automations

Combine email with **Automations** for event-driven notifications:

> "When a task is marked done, email the team"

The agent creates an automation: `trigger: task.updated (filter: status=done)` → `action: send_email`.
