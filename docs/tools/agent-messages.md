# Inter-Agent Messaging

**Tool set name**: `agent_messages`
**Default**: Disabled

Agents communicate with other agents owned by the same user. Enables multi-agent workflows, delegation, specialization, and coordination.

## Tools

| Tool | Description |
|------|-------------|
| `list_sibling_agents` | List other active agents you can message |
| `send_to_agent` | Send a message + optional context to another agent |
| `check_agent_messages` | Check for pending messages from other agents |
| `respond_to_agent` | Reply to a message and mark it as processed |

## How It Works

1. **Agent A** sends a message to **Agent B** via `send_to_agent`
2. Message is queued with status `pending`
3. **Agent B** picks up the message via `check_agent_messages` (during its next conversation)
4. **Agent B** processes the message and responds via `respond_to_agent`
5. Events emitted: `agent_message.sent`, `agent_message.received`

## Message Structure

```json
{
  "fromAgentId": "agent_abc",
  "toAgentId": "agent_xyz",
  "content": "Please analyze the sales data from last week",
  "context": {
    "spreadsheetId": "tab_123",
    "dateRange": "2026-03-10 to 2026-03-16"
  },
  "status": "pending"
}
```

The `context` field passes structured data that the target agent can use — IDs, parameters, data objects.

## Use Cases

### Router Agent
A "receptionist" agent that routes work to specialists:

```
User → Router Agent: "I need help with a billing issue"
Router Agent → Billing Agent: "Customer has a billing issue. Details: ..."
Billing Agent processes and responds
```

### Delegation
A project manager agent delegates research:

```
PM Agent → Research Agent: "Find the top 5 competitors in the AI agent space"
Research Agent does web search and responds with findings
PM Agent creates a report from the findings
```

### Pipeline Processing
Chain agents for multi-step processing:

```
Data Agent → Analysis Agent: "Here's the raw data, find patterns"
Analysis Agent → Report Agent: "Here are the patterns, create a summary"
```

### Notification Relay
One agent monitors and notifies others:

```
Monitor Agent detects issue
Monitor Agent → DevOps Agent: "API latency spike detected"
Monitor Agent → Manager Agent: "Incident report for review"
```

## Security

- Agents can only message other agents owned by **the same user**
- Cross-user agent messaging is not allowed
- Maximum 50 pending messages per target agent

## Integration with Automations

Combine with automations for event-driven multi-agent workflows:

```json
{
  "trigger": { "event": "task.created", "filter": { "priority": "high" } },
  "actions": [
    {
      "type": "trigger_agent",
      "config": {
        "agentId": "agent_xyz",
        "message": "High-priority task needs immediate attention: {{event.title}}"
      }
    }
  ]
}
```

## Limits

| Limit | Value |
|-------|-------|
| Pending messages per agent | 50 |
| Message content | 10,000 chars |
| Response content | 10,000 chars |
