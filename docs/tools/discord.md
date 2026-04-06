# Discord

**Tool set name**: `discord`
**Default**: Disabled
**Requires**: Discord bot token

Connect your agent to Discord to send messages, read channels, manage threads, react to messages, and browse servers.

## Getting Your Discord Bot Token

You need to create a Discord application and bot to get a token. This takes about 5 minutes.

### Step 1 — Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** (top right)
3. Give it a name (e.g. "My Agent Bot") and click **Create**

### Step 2 — Create a Bot

1. In your application, click **Bot** in the left sidebar
2. Click **Add Bot** → **Yes, do it!**
3. Under the bot's username, click **Reset Token** → **Yes, do it!**
4. Copy the token — this is your **Bot Token** (starts with `MTk...` or similar)
5. Keep this token secret — anyone with it can control your bot

> **Tip**: Enable **Message Content Intent** on the same Bot page if you want the bot to read message content (required for `discord_read_messages`).

### Step 3 — Set Permissions

1. Go to **OAuth2 → URL Generator** in the left sidebar
2. Under **Scopes**, check `bot`
3. Under **Bot Permissions**, check:
   - `Send Messages`
   - `Read Message History`
   - `View Channels`
   - `Add Reactions`
   - `Create Public Threads`
   - `Send Messages in Threads`
4. Copy the generated URL at the bottom

### Step 4 — Invite the Bot to Your Server

1. Open the generated URL in your browser
2. Select the server you want to add the bot to
3. Click **Authorise**

The bot will now appear as offline in your server — it goes "online" when the agent uses it.

### Step 5 — Add the Credential in HiGantic

1. Go to your agent's **Settings** page
2. Enable the **Discord** tool set
3. Click **Add Credential** → **Discord Bot**
4. Paste your **Bot Token** and save

---

## Tools

| Tool | Description |
|------|-------------|
| `discord_list_guilds` | List all servers (guilds) the bot is a member of |
| `discord_list_channels` | List channels in a server — use this to find channel IDs |
| `discord_send_message` | Send a message to a channel (supports Discord markdown) |
| `discord_read_messages` | Read recent messages from a channel (up to 100) |
| `discord_add_reaction` | React to a message with an emoji (Unicode or custom) |
| `discord_create_thread` | Create a thread from a message or standalone in a channel |
| `discord_reply_in_thread` | Send a message inside an existing thread |

## Event Bus Integration

The following events are emitted and can be used as automation triggers:

| Event | When it fires |
|-------|--------------|
| `discord.message_sent` | A message or thread reply was sent |
| `discord.thread_created` | A new thread was created |

## Example Usage

**User**: "Post a release announcement to #general"

**Agent**: Uses `discord_list_guilds` to find the server, `discord_list_channels` to find `#general`'s ID, then `discord_send_message` to post.

---

**User**: "Create a thread in #support for the billing issue"

**Agent**: Uses `discord_create_thread` to open a new thread, then `discord_reply_in_thread` to post the first message inside it.

---

**User**: "What's the latest in #dev-updates?"

**Agent**: Uses `discord_read_messages` on the channel to fetch recent messages and summarizes them.

## Two-Way Chat (Discord Bot Mode)

Enable **Discord Bot** in agent settings to let users @mention the bot in Discord and get responses directly in the channel — no web UI needed.

### How it works

1. The agent server maintains a persistent WebSocket connection (Discord Gateway) for each enabled agent
2. When someone @mentions the bot, the message is routed through the agent pipeline
3. The response is posted back to the same Discord channel

### Dual-mode responses

| Who @mentions | Mode | Response |
|---|---|---|
| Authorized user (whitelist) | **Agent mode** | Full agent: system prompt, all tools, memory, web search |
| Anyone else | **Bot mode** | Custom "Bot Prompt" you define in settings |

### Setting it up

1. Go to agent **Settings → Integrations**
2. Enable **Discord** and add your bot token credential
3. Scroll to **Discord Bot (Two-Way Chat)**
4. Toggle **Enable Discord Bot** on
5. Write a **Bot Prompt** for public-facing responses (leave blank to use the agent's system prompt for everyone)
6. Add Discord usernames to **Authorized Users** for full agent access
7. Save

### Conversation continuity

Each Discord channel maintains its own conversation context. Follow-up messages in the same channel continue the conversation — just like the web chat.

## Notes

- The bot must be invited to a server before it can interact with it
- The bot can only see channels it has permission to access in that server
- `discord_add_reaction` accepts Unicode emoji (e.g. `👍`) or custom emoji in `name:id` format (e.g. `myemoji:123456`)
- Threads are treated as channels — use the thread ID as the `channel_id` when reading or replying
- The Discord Bot gateway connects automatically when the agent server starts (3s delay)
- Config changes take effect within ~60 seconds (the manager re-syncs every minute)
