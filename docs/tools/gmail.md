# Gmail

**Tool set name**: `gmail`
**Default**: Disabled
**Requires**: Google OAuth2 credential (same as Google Calendar/Drive/Sheets)

Read, search, send, reply to emails, and manage labels in the user's Gmail inbox.

## Setup

### 1. Enable Gmail API in Google Cloud Console
- Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Library
- Search for **"Gmail API"** and enable it
- This uses the same Google Cloud project as your existing Google OAuth client

### 2. Connect Google Credential
**If you already have Google connected** (Calendar, Drive, or Sheets):
- Go to **Settings → Credentials**
- Click **Reconnect** on your existing Google credential
- Google will show only the new Gmail scopes — approve them
- Your existing Calendar/Drive/Sheets access is preserved (incremental authorization)

**If connecting fresh:**
- Go to **Settings → Credentials → + Add Credential → Google (OAuth2)**
- Click **Connect with Google** — consent screen covers all Google scopes at once

### 3. Enable Gmail on the Agent
- Go to **Agent → Settings → Integrations**
- Toggle **Gmail** on
- In the Gmail Credentials section below, select your Google credential → **Link**

## Tools

| Tool | Description |
|------|-------------|
| `gmail_list_messages` | List recent emails from inbox (supports label filters) |
| `gmail_search` | Search emails using Gmail's search syntax |
| `gmail_get_message` | Get full content of a specific message |
| `gmail_get_thread` | Get all messages in an email thread/conversation |
| `gmail_send` | Compose and send a new email |
| `gmail_reply` | Reply to an existing message (auto-threads) |
| `gmail_list_labels` | List all Gmail labels (system + custom) |
| `gmail_modify_labels` | Add/remove labels (archive, star, mark read/unread) |

### gmail_list_messages

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `max_results` | number | No | Max messages to return (default 10, max 50) |
| `label` | string | No | Filter by label: `INBOX`, `UNREAD`, `STARRED`, `SENT`, `DRAFT`, or custom label ID |
| `page_token` | string | No | Token for next page of results |

### gmail_search

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Gmail search query (same syntax as the search bar) |
| `max_results` | number | No | Max results (default 10, max 50) |

**Query examples**: `from:alice subject:invoice`, `is:unread`, `newer_than:2d`, `has:attachment`, `label:work`

### gmail_get_message

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message_id` | string | Yes | Gmail message ID |

Returns full body (HTML + plain text), all headers, and attachment list.

### gmail_get_thread

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `thread_id` | string | Yes | Gmail thread ID |

Returns all messages in the conversation in order.

### gmail_send

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string or string[] | Yes | Recipient email address(es) |
| `subject` | string | Yes | Email subject line |
| `body` | string | Yes | Email body (supports HTML) |
| `cc` | string[] | No | CC recipients |
| `bcc` | string[] | No | BCC recipients |
| `reply_to` | string | No | Reply-to address |

### gmail_reply

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message_id` | string | Yes | ID of the message to reply to |
| `body` | string | Yes | Reply body (supports HTML) |
| `reply_all` | boolean | No | Reply to all recipients including CC (default false) |

Automatically sets `In-Reply-To` and `References` headers to keep the reply in the same thread.

### gmail_list_labels

No parameters. Returns all labels with ID, name, type (system/user), and unread count.

### gmail_modify_labels

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message_id` | string | Yes | Gmail message ID |
| `add_labels` | string[] | No | Label IDs to add (e.g. `STARRED`, `IMPORTANT`) |
| `remove_labels` | string[] | No | Label IDs to remove (e.g. `UNREAD` to mark read, `INBOX` to archive) |

## Event Bus Integration

| Event | Trigger | Payload Fields |
|-------|---------|----------------|
| `gmail.sent` | Email sent successfully | `to`, `subject`, `body`, `cc`, `bcc`, `gmailMessageId`, `threadId` |
| `gmail.failed` | Email send failed | `to`, `subject`, `error` |
| `gmail.replied` | Reply sent | `to`, `subject`, `originalMessageId`, `gmailMessageId`, `threadId` |
| `gmail.labels_modified` | Labels changed | `messageId`, `addedLabels`, `removedLabels` |

## Example Usage

**Check unread emails:**
> "Do I have any unread emails?"

Agent calls `gmail_list_messages` with label `UNREAD` and summarizes results.

**Search and read:**
> "Find emails from alice@company.com about the Q4 report"

Agent calls `gmail_search` with `from:alice@company.com subject:Q4 report`, then `gmail_get_message` on results.

**Reply to a thread:**
> "Reply to that last email and say I'll review it by Friday"

Agent calls `gmail_get_message` to get context, then `gmail_reply` with the response.

**Archive and organize:**
> "Archive all emails from newsletter@promo.com"

Agent calls `gmail_search` with `from:newsletter@promo.com`, then `gmail_modify_labels` (remove `INBOX`) for each result.

## Using with Automations

```
Trigger: gmail.sent
Action: store_memory "Sent email to {{event.to}} re: {{event.subject}}"

Trigger: gmail.replied
Action: create_task "Follow up on: {{event.subject}}"
```

## Notes

- Emails are sent from the Gmail account that was connected via OAuth
- The Gmail API must be enabled in the same Google Cloud project as the OAuth client
- Sending limits follow Gmail's standard sending quotas (500/day for personal, 2000/day for Workspace)
- The `gmail_send` and `gmail_reply` tools also log to the `emailLogs` table for audit tracking
