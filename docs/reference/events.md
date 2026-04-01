# Event Types Reference

All events emitted by the event bus. Use these as triggers for automations or for monitoring agent activity.

## Task Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `task.created` | `page_tools`, `webhook`, `automation`, `scheduler`, `timer` | `taskId`, `title`, `description`, `status`, `priority` |
| `task.updated` | `page_tools`, `webhook`, `automation` | `taskId`, `title`, `status`, `priority` |
| `task.deleted` | `page_tools`, `webhook` | `taskId`, `title` |

## Note Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `note.created` | `page_tools`, `automation` | `noteId`, `title` |
| `note.updated` | `page_tools` | `noteId`, `title` |

## Email Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `email.sent` | `email_tools`, `automation`, `scheduler`, `timer` | `to`, `subject`, `resendId` |
| `email.failed` | `email_tools` | `to`, `subject`, `error` |

## Gmail Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `gmail.sent` | `gmail_tools` | `to`, `subject`, `body`, `cc`, `bcc`, `replyTo`, `gmailMessageId`, `threadId` |
| `gmail.failed` | `gmail_tools` | `to`, `subject`, `error` |
| `gmail.replied` | `gmail_tools` | `to`, `subject`, `originalMessageId`, `gmailMessageId`, `threadId` |
| `gmail.labels_modified` | `gmail_tools` | `messageId`, `addedLabels`, `removedLabels` |

## Webhook Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `webhook.received` | `webhook` | `webhookId`, `action`, `body` |
| `webhook.fired` | `webhook_tools`, `automation`, `scheduler`, `timer` | `url`, `event`, `status` |

## Schedule Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `schedule.fired` | `scheduler` | `actionId`, `actionName`, `success`, `result`, `error` |

## Timer Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `timer.fired` | `timer` | `timerId`, `label`, `actionType` |

## Memory Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `memory.stored` | `memory_tools`, `automation` | `content`, `category` |

## Document Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `document.ready` | `document_processor` | `documentId`, `fileName`, `chunkCount` |

## Agent Message Events

| Event | Source | Payload Fields |
|-------|--------|----------------|
| `agent_message.sent` | `agent_message_tools`, `automation` | `toAgentId`, `messageId` |
| `agent_message.received` | `agent_message_tools` | `fromAgentId`, `messageId` |

## Using Events in Automations

### Trigger Format
```json
{
  "event": "task.updated",
  "filter": { "status": "done", "priority": "high" }
}
```

### Template Variables
Access payload fields in automation action configs:
```
{{event.title}}       → payload.title
{{event.status}}      → payload.status
{{event.taskId}}      → payload.taskId
{{event.to}}          → payload.to
{{event.actionName}}  → payload.actionName
```

## Event Retention

Events are stored for **7 days**. A cleanup process removes older events.
