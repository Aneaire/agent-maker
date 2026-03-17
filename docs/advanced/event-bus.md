# Event Bus

The event bus is the interconnection layer that ties all tools together. Every significant action emits an event, and automations subscribe to those events.

## Architecture

```
Tool Action → Event Emitted → Automations Checked → Actions Executed
                            → Outgoing Webhooks Fired
                            → Event Logged for History
```

## Event Flow

1. An agent tool performs an action (create task, send email, etc.)
2. An event is emitted to the `agentEvents` table
3. The server checks for matching automations
4. If filter conditions match, automation actions execute in order
5. Outgoing webhooks for the event type are also fired
6. The event is stored for historical viewing via `list_events`

## All Event Types

### Task Events
| Event | Source | Payload |
|-------|--------|---------|
| `task.created` | `page_tools`, `webhook`, `automation` | `{ taskId, title, description, status, priority }` |
| `task.updated` | `page_tools`, `webhook`, `automation` | `{ taskId, title, status, priority }` |
| `task.deleted` | `page_tools`, `webhook` | `{ taskId, title }` |

### Note Events
| Event | Source | Payload |
|-------|--------|---------|
| `note.created` | `page_tools`, `automation` | `{ noteId, title }` |
| `note.updated` | `page_tools` | `{ noteId, title }` |

### Email Events
| Event | Source | Payload |
|-------|--------|---------|
| `email.sent` | `email_tools`, `automation`, `scheduler` | `{ to, subject, resendId }` |
| `email.failed` | `email_tools` | `{ to, subject, error }` |

### Webhook Events
| Event | Source | Payload |
|-------|--------|---------|
| `webhook.received` | `webhook` | `{ webhookId, action, body }` |
| `webhook.fired` | `webhook_tools`, `automation`, `scheduler` | `{ url, event, status }` |

### Schedule Events
| Event | Source | Payload |
|-------|--------|---------|
| `schedule.fired` | `scheduler` | `{ actionId, actionName, success, result, error }` |

### Timer Events
| Event | Source | Payload |
|-------|--------|---------|
| `timer.fired` | `timer` | `{ timerId, label, actionType }` |

### Memory Events
| Event | Source | Payload |
|-------|--------|---------|
| `memory.stored` | `memory_tools`, `automation` | `{ content, category }` |

### Document Events
| Event | Source | Payload |
|-------|--------|---------|
| `document.ready` | `document_processor` | `{ documentId, fileName, chunkCount }` |

### Agent Message Events
| Event | Source | Payload |
|-------|--------|---------|
| `agent_message.sent` | `agent_message_tools` | `{ toAgentId, messageId }` |
| `agent_message.received` | `agent_message_tools` | `{ fromAgentId, messageId }` |

## Viewing Events

Agents with the `webhooks` tool set can view event history:

```
list_events
  event_type: "task.created"   (optional filter)
  limit: 20                    (default 20, max 50)
```

Users can also view events in the agent's settings/events UI.

## Event Retention

Events are retained for 7 days. A cleanup job removes older events automatically.

## Template Variables in Automations

When an automation triggers, the event payload is available as template variables:

```
{{event.title}}       → From payload.title
{{event.status}}      → From payload.status
{{event.taskId}}      → From payload.taskId
{{event.to}}          → From payload.to
```

Use these in automation action configs to pass data through the chain.

## Example: Full Event Chain

```
1. Incoming webhook received
   → Event: webhook.received

2. Automation triggers: "On webhook.received → create_task"
   → Task created
   → Event: task.created

3. Automation triggers: "On task.created with priority=high → send_email + fire_webhook"
   → Email sent → Event: email.sent
   → Webhook fired → Event: webhook.fired

4. Schedule fires daily: "Summarize today's events"
   → Event: schedule.fired
```

Four tool systems interconnected through the event bus, all from a single incoming webhook.
