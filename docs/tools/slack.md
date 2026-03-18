# Slack

**Tool set name**: `slack`
**Default**: Disabled
**Requires**: Slack bot token

Connect your agent to Slack to send messages, read channels, react to messages, and search conversations.

## Setup

1. Go to your agent's **Settings** page
2. Enable the **Slack** tool set
3. Configure:
   - **Bot Token** — A Slack bot token (`xoxb-...`) from your Slack app. Required scopes: `chat:write`, `channels:read`, `channels:history`, `reactions:write`, `search:read`
   - **Default Channel** (optional) — A fallback channel ID for messages when no channel is specified

## Tools

| Tool | Description |
|------|-------------|
| `slack_send_message` | Send a message to a channel (supports threads and mrkdwn formatting) |
| `slack_list_channels` | List public and private channels the bot has access to |
| `slack_read_messages` | Read recent messages from a channel or thread |
| `slack_add_reaction` | Add an emoji reaction to a message |
| `slack_set_topic` | Set a channel's topic |
| `slack_search_messages` | Search messages across channels (supports Slack search modifiers) |

## Event Bus Integration

The following events are emitted:
- `slack.message_sent` — Message posted to a channel
- `slack.topic_set` — Channel topic updated

## Example Usage

**User**: "Post the weekly update to #engineering"

**Agent**: Uses `slack_list_channels` to find the channel ID, then `slack_send_message` to post the message.

**User**: "What's been discussed in #design today?"

**Agent**: Uses `slack_read_messages` on the #design channel to retrieve recent messages and summarizes them.

**User**: "Search Slack for messages about the API migration"

**Agent**: Uses `slack_search_messages` with the query to find relevant conversations across channels.
