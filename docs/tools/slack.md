# Slack

**Tool set name**: `slack`
**Default**: Disabled
**Requires**: Slack bot token

Connect your agent to Slack to send messages, read channels, react to messages, and search conversations.

## Getting a Slack Bot Token

You need to create a Slack app in the workspace you want the agent to act in.

1. Go to <https://api.slack.com/apps> and click **Create New App** → **From scratch**.
2. Give it a name (e.g. "Agent Maker") and pick the target workspace.
3. In the left sidebar, open **OAuth & Permissions**.
4. Under **Scopes → Bot Token Scopes**, add the scopes you need:

   | Scope | Required for |
   |-------|--------------|
   | `chat:write` | Sending messages and DMs |
   | `channels:read` | Listing public channels |
   | `groups:read` | Listing private channels |
   | `channels:history` | Reading public channel messages |
   | `groups:history` | Reading private channel messages |
   | `reactions:write` | Adding emoji reactions |
   | `search:read.public` | `slack_search_messages` — search public channels |
   | `search:read.private` | `slack_search_messages` — search private channels the bot is in |
   | `search:read.im` | `slack_search_messages` in DMs (optional) |
   | `search:read.mpim` | `slack_search_messages` in group DMs (optional) |
   | `search:read.files` | `slack_search_files` |
   | `search:read.users` | `slack_search_users` |
   | `users:read` | `slack_list_users` |
   | `users:read.email` | Returning user emails from `slack_list_users` (optional) |
   | `im:write` | Opening DM conversations for `slack_send_dm` |
   | `files:write` | Uploading files via `slack_upload_file` |
   | `pins:write` | `slack_pin_message` / `slack_unpin_message` |
   | `channels:manage` | `slack_create_channel`, `slack_invite_to_channel` (public) |
   | `groups:write` | `slack_create_channel` (private), `slack_invite_to_channel` (private) |
   | `channels:join` | `slack_join_channel` |

5. Scroll up to the **OAuth Tokens** section and click the green **Install to [YourWorkspace]** button (Slack labels it with your workspace name, e.g. "Install to Aneaire"). Approve the permissions.
6. After install, copy the **Bot User OAuth Token** (starts with `xoxb-`) shown on the same page.
7. **Invite the bot to each channel** you want it to post in or read from: in Slack, run `/invite @YourAppName` inside the channel. The bot can only see channels it has been invited to.

> **search scopes note**: Slack split the legacy `search:read` scope into granular ones. Pick the surfaces you want searchable. If your workspace only exposes the search scopes under **User Token Scopes**, you must install with a user token (`xoxp-`) for `slack_search_messages` / `slack_search_files` to work — all other tools work fine with the bot token alone.

## Configure in Agent Maker

1. Go to your agent's **Settings** page.
2. Enable the **Slack** tool set.
3. Paste:
   - **Bot Token** — the `xoxb-...` token from step 6 above.
   - **Default Channel** (optional) — a channel ID (e.g. `C01234ABCDE`) used as a fallback when no channel is specified.

## Tools

| Tool | Description |
|------|-------------|
| `slack_send_message` | Send a message to a channel (supports threads and mrkdwn formatting) |
| `slack_list_channels` | List public and private channels the bot has access to |
| `slack_read_messages` | Read recent messages from a channel or thread |
| `slack_add_reaction` | Add an emoji reaction to a message |
| `slack_set_topic` | Set a channel's topic |
| `slack_search_messages` | Search messages across channels (supports Slack search modifiers) |
| `slack_search_files` | Search uploaded files across the workspace |
| `slack_search_users` | Search users by name fragment (faster than `slack_list_users` on large workspaces) |
| `slack_list_users` | List workspace users — use to resolve a name to a user ID |
| `slack_send_dm` | Send a direct message to a user by user ID |
| `slack_upload_file` | Upload a text file or snippet to a channel |
| `slack_update_message` | Edit a message previously posted by the bot |
| `slack_delete_message` | Delete a message previously posted by the bot |
| `slack_schedule_message` | Schedule a message to post at a future Unix timestamp |
| `slack_get_permalink` | Get a shareable permalink URL for a message |
| `slack_lookup_user_by_email` | Look up a user by email (faster than listing all users) |
| `slack_pin_message` | Pin a message in a channel |
| `slack_unpin_message` | Unpin a message from a channel |
| `slack_create_channel` | Create a new public or private channel |
| `slack_join_channel` | Bot joins a public channel so it can post and read |
| `slack_invite_to_channel` | Invite users to a channel by ID |

## Event Bus Integration

The following events are emitted:
- `slack.message_sent` — Message posted to a channel
- `slack.topic_set` — Channel topic updated
- `slack.dm_sent` — Direct message sent to a user
- `slack.file_uploaded` — File uploaded to a channel
- `slack.message_updated` — Bot edited a message
- `slack.message_deleted` — Bot deleted a message
- `slack.message_scheduled` — A message was scheduled for future delivery
- `slack.message_pinned` — A message was pinned in a channel
- `slack.message_unpinned` — A message was unpinned from a channel
- `slack.channel_created` — A channel was created
- `slack.channel_joined` — Bot joined a channel
- `slack.users_invited` — Users were invited to a channel
- `slack.mention_received` — Bot was @mentioned in a channel (Socket Mode bot)
- `slack.dm_received` — Bot received a direct message (Socket Mode bot)

## Conversational Bot (Socket Mode)

In addition to the outbound tools above, you can run the agent as a **two-way conversational bot** that replies when @mentioned in a channel or sent a DM. This uses Slack **Socket Mode** (a persistent WebSocket — no public URL required).

### One-time Slack app setup

1. In <https://api.slack.com/apps> → your app → **Socket Mode** → toggle **Enable Socket Mode** on. When prompted, generate a token name (e.g. "agent-maker") and grant the `connections:write` scope. Copy the **App-Level Token** that starts with `xapp-…`.
2. **Event Subscriptions** → toggle on → under **Subscribe to bot events** add:
   - `app_mention`
   - `message.im`
3. **App Home** → Show Tabs → enable **Messages Tab** → check **"Allow users to send Slash commands and messages from the messages tab"** (otherwise DMs are blocked).
4. **OAuth & Permissions** → ensure these bot scopes are present in addition to the ones above:
   - `app_mentions:read`
   - `im:history`
   - `im:read`
5. Reinstall the app to your workspace when Slack prompts.

### Configure in Agent Maker

1. Open the Slack credential and paste the new `xapp-…` token into the **App-Level Token (Socket Mode)** field.
2. Open the agent's **Settings** page → enable the **Slack Bot (Two-Way Chat)** section.
3. Optionally fill in:
   - **Bot Prompt** — used as the system prompt for users not on the authorized list.
   - **Bot Model** — model override for unauthorized users.
   - **Authorized Slack User IDs** — add the Slack user IDs (e.g. `U0AR2KKC2Q3`) of people who should get full agent access (all tools, memory, etc.). Everyone else falls back to Bot mode.
4. Save. The agent server picks up the change on its next sync (within 60 seconds, or immediately if `/dispatch/slack-sync` is called).

### How it works

- Inbound messages arrive on the persistent Socket Mode WebSocket and are routed to a Convex conversation that's persistent per `(agent, channel)` — so threaded back-and-forth keeps context across mentions, just like the Discord bot.
- Each inbound message emits `slack.mention_received` or `slack.dm_received` to the event bus, so you can wire automations off them.
- Replies are posted via `chat.postMessage`. If the inbound was in a thread, the reply is posted in the same thread.

## Example Usage

**User**: "Post the weekly update to #engineering"

**Agent**: Uses `slack_list_channels` to find the channel ID, then `slack_send_message` to post the message.

**User**: "What's been discussed in #design today?"

**Agent**: Uses `slack_read_messages` on the #design channel to retrieve recent messages and summarizes them.

**User**: "Search Slack for messages about the API migration"

**Agent**: Uses `slack_search_messages` with the query to find relevant conversations across channels.
