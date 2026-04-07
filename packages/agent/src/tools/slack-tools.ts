import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

interface SlackConfig {
  botToken: string;
  defaultChannel?: string;
}

const SLACK_BASE = "https://slack.com/api";

async function slackApi(
  config: SlackConfig,
  method: string,
  body?: Record<string, any>
) {
  const res = await fetch(`${SLACK_BASE}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
  return data;
}

async function slackApiForm(
  config: SlackConfig,
  method: string,
  params: Record<string, string>
) {
  const res = await fetch(`${SLACK_BASE}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
  return data;
}

export function createSlackTools(
  convexClient: AgentConvexClient,
  agentId: string,
  slackConfig: SlackConfig
) {
  // ── Send Message ────────────────────────────────────────────────────
  const sendMessage = tool(
    "slack_send_message",
    "Send a message to a Slack channel. Supports Slack markdown (mrkdwn) formatting.",
    {
      channel: z
        .string()
        .describe(
          "Channel ID or name (e.g. 'C01234ABCDE' or '#general')"
        ),
      text: z.string().describe("Message text (supports Slack mrkdwn formatting)"),
      thread_ts: z
        .string()
        .optional()
        .describe("Thread timestamp to reply in a thread"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "chat.postMessage", {
          channel: input.channel,
          text: input.text,
          ...(input.thread_ts && { thread_ts: input.thread_ts }),
        });

        await convexClient.emitEvent(agentId, "slack.message_sent", "slack_tools", {
          channel: input.channel,
          text: input.text,
          ts: result.ts,
          threadTs: input.thread_ts,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Message sent to ${input.channel}. Timestamp: ${result.ts}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to send message: ${err.message}` }],
        };
      }
    }
  );

  // ── List Channels ───────────────────────────────────────────────────
  const listChannels = tool(
    "slack_list_channels",
    "List public and joined Slack channels. Use this to find channel IDs before sending messages.",
    {
      limit: z
        .number()
        .min(1)
        .max(200)
        .optional()
        .describe("Max channels to return (default 50)"),
      types: z
        .string()
        .optional()
        .describe(
          "Comma-separated channel types: public_channel, private_channel, mpim, im (default: public_channel,private_channel)"
        ),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "conversations.list", {
          limit: input.limit ?? 50,
          types: input.types ?? "public_channel,private_channel",
          exclude_archived: true,
        });

        const channels = (result.channels ?? []).map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          topic: ch.topic?.value || "",
          memberCount: ch.num_members,
          isPrivate: ch.is_private,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(channels, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to list channels: ${err.message}` }],
        };
      }
    }
  );

  // ── Read Messages ───────────────────────────────────────────────────
  const readMessages = tool(
    "slack_read_messages",
    "Read recent messages from a Slack channel. Returns messages with author, text, timestamp, and thread info.",
    {
      channel: z.string().describe("Channel ID"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of messages to fetch (default 20)"),
      thread_ts: z
        .string()
        .optional()
        .describe("If provided, read replies in this thread instead of channel messages"),
    },
    async (input) => {
      try {
        let result;
        if (input.thread_ts) {
          result = await slackApi(slackConfig, "conversations.replies", {
            channel: input.channel,
            ts: input.thread_ts,
            limit: input.limit ?? 20,
          });
        } else {
          result = await slackApi(slackConfig, "conversations.history", {
            channel: input.channel,
            limit: input.limit ?? 20,
          });
        }

        const messages = (result.messages ?? []).map((msg: any) => ({
          ts: msg.ts,
          user: msg.user,
          text: msg.text,
          threadTs: msg.thread_ts,
          replyCount: msg.reply_count,
          reactions: (msg.reactions ?? []).map((r: any) => `${r.name} (${r.count})`),
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to read messages: ${err.message}` }],
        };
      }
    }
  );

  // ── Add Reaction ────────────────────────────────────────────────────
  const addReaction = tool(
    "slack_add_reaction",
    "Add an emoji reaction to a message in Slack.",
    {
      channel: z.string().describe("Channel ID"),
      timestamp: z.string().describe("Message timestamp to react to"),
      emoji: z
        .string()
        .describe("Emoji name without colons (e.g. 'thumbsup', 'white_check_mark')"),
    },
    async (input) => {
      try {
        await slackApi(slackConfig, "reactions.add", {
          channel: input.channel,
          timestamp: input.timestamp,
          name: input.emoji,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Reaction :${input.emoji}: added.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to add reaction: ${err.message}` }],
        };
      }
    }
  );

  // ── Set Channel Topic ───────────────────────────────────────────────
  const setChannelTopic = tool(
    "slack_set_topic",
    "Set the topic of a Slack channel.",
    {
      channel: z.string().describe("Channel ID"),
      topic: z.string().describe("New channel topic text"),
    },
    async (input) => {
      try {
        await slackApi(slackConfig, "conversations.setTopic", {
          channel: input.channel,
          topic: input.topic,
        });

        await convexClient.emitEvent(agentId, "slack.topic_set", "slack_tools", {
          channel: input.channel,
          topic: input.topic,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Channel topic updated to: "${input.topic}"`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to set topic: ${err.message}` }],
        };
      }
    }
  );

  // ── Search Messages ─────────────────────────────────────────────────
  const searchMessages = tool(
    "slack_search_messages",
    "Search for messages across Slack channels. Requires a user token with search:read scope.",
    {
      query: z.string().describe("Search query (supports Slack search modifiers like 'in:#channel from:@user')"),
      count: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results (default 20)"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "search.messages", {
          query: input.query,
          count: input.count ?? 20,
          sort: "timestamp",
          sort_dir: "desc",
        });

        const matches = (result.messages?.matches ?? []).map((msg: any) => ({
          text: msg.text,
          user: msg.user ?? msg.username,
          channel: msg.channel?.name,
          ts: msg.ts,
          permalink: msg.permalink,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: matches.length > 0
                ? JSON.stringify(matches, null, 2)
                : "No messages found.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Search failed: ${err.message}` }],
        };
      }
    }
  );

  // ── Search Files ────────────────────────────────────────────────────
  const searchFiles = tool(
    "slack_search_files",
    "Search for files across Slack. Requires the search:read.files scope.",
    {
      query: z.string().describe("Search query (supports Slack search modifiers)"),
      count: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results (default 20)"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "search.files", {
          query: input.query,
          count: input.count ?? 20,
          sort: "timestamp",
          sort_dir: "desc",
        });

        const matches = (result.files?.matches ?? []).map((f: any) => ({
          id: f.id,
          name: f.name,
          title: f.title,
          filetype: f.filetype,
          user: f.user,
          channel: f.channels?.[0],
          permalink: f.permalink,
          urlPrivate: f.url_private,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: matches.length > 0
                ? JSON.stringify(matches, null, 2)
                : "No files found.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `File search failed: ${err.message}` }],
        };
      }
    }
  );

  // ── Search Users ────────────────────────────────────────────────────
  const searchUsers = tool(
    "slack_search_users",
    "Search workspace users by name or fragment. Faster than slack_list_users on large workspaces. Requires search:read.users scope.",
    {
      query: z.string().describe("Search query (name fragment, display name, etc.)"),
      count: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results (default 20)"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "search.users", {
          query: input.query,
          count: input.count ?? 20,
        });

        const matches = (result.users?.matches ?? result.users ?? []).map((u: any) => ({
          id: u.id,
          name: u.name,
          realName: u.real_name,
          displayName: u.profile?.display_name,
          email: u.profile?.email,
          isBot: u.is_bot,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: matches.length > 0
                ? JSON.stringify(matches, null, 2)
                : "No users found.",
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `User search failed: ${err.message}` }],
        };
      }
    }
  );

  // ── List Users ──────────────────────────────────────────────────────
  const listUsers = tool(
    "slack_list_users",
    "List workspace users. Use this to resolve a person's name to a user ID for DMs or mentions.",
    {
      limit: z
        .number()
        .min(1)
        .max(200)
        .optional()
        .describe("Max users to return (default 100)"),
      include_bots: z
        .boolean()
        .optional()
        .describe("Include bot users (default false)"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "users.list", {
          limit: input.limit ?? 100,
        });

        const users = (result.members ?? [])
          .filter((u: any) => !u.deleted && (input.include_bots || !u.is_bot))
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            realName: u.real_name,
            displayName: u.profile?.display_name,
            email: u.profile?.email,
            isBot: u.is_bot,
          }));

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(users, null, 2) },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to list users: ${err.message}` }],
        };
      }
    }
  );

  // ── Send Direct Message ─────────────────────────────────────────────
  const sendDirectMessage = tool(
    "slack_send_dm",
    "Send a direct message to a Slack user by user ID. Opens a DM channel and posts the message.",
    {
      user_id: z.string().describe("Slack user ID (e.g. 'U01234ABCDE'). Use slack_list_users to find IDs."),
      text: z.string().describe("Message text (supports Slack mrkdwn formatting)"),
    },
    async (input) => {
      try {
        const open = await slackApi(slackConfig, "conversations.open", {
          users: input.user_id,
        });
        const channelId = open.channel?.id;
        if (!channelId) throw new Error("Could not open DM channel");

        const result = await slackApi(slackConfig, "chat.postMessage", {
          channel: channelId,
          text: input.text,
        });

        await convexClient.emitEvent(agentId, "slack.dm_sent", "slack_tools", {
          userId: input.user_id,
          channel: channelId,
          text: input.text,
          ts: result.ts,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `DM sent to ${input.user_id} (channel ${channelId}). Timestamp: ${result.ts}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to send DM: ${err.message}` }],
        };
      }
    }
  );

  // ── Upload File ─────────────────────────────────────────────────────
  const uploadFile = tool(
    "slack_upload_file",
    "Upload a text file or snippet to a Slack channel. Provide the content as a string.",
    {
      channel: z.string().describe("Channel ID to share the file in"),
      filename: z.string().describe("Filename (e.g. 'report.txt', 'data.json')"),
      content: z.string().describe("Text content of the file"),
      title: z.string().optional().describe("Optional file title"),
      initial_comment: z
        .string()
        .optional()
        .describe("Optional message to post alongside the file"),
    },
    async (input) => {
      try {
        const bytes = new TextEncoder().encode(input.content);
        const length = bytes.length;

        // Step 1: get upload URL
        const upload = await slackApiForm(slackConfig, "files.getUploadURLExternal", {
          filename: input.filename,
          length: String(length),
        });
        const uploadUrl: string = upload.upload_url;
        const fileId: string = upload.file_id;

        // Step 2: PUT raw bytes
        const putRes = await fetch(uploadUrl, {
          method: "POST",
          body: bytes,
        });
        if (!putRes.ok) {
          throw new Error(`Upload PUT failed: ${putRes.status} ${putRes.statusText}`);
        }

        // Step 3: complete upload
        await slackApi(slackConfig, "files.completeUploadExternal", {
          files: [{ id: fileId, title: input.title ?? input.filename }],
          channel_id: input.channel,
          ...(input.initial_comment && { initial_comment: input.initial_comment }),
        });

        await convexClient.emitEvent(agentId, "slack.file_uploaded", "slack_tools", {
          channel: input.channel,
          filename: input.filename,
          fileId,
          size: length,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `File "${input.filename}" uploaded to ${input.channel} (id: ${fileId}, ${length} bytes).`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to upload file: ${err.message}` }],
        };
      }
    }
  );

  // ── Update Message ──────────────────────────────────────────────────
  const updateMessage = tool(
    "slack_update_message",
    "Edit a message previously posted by the bot. Provide the channel and message timestamp.",
    {
      channel: z.string().describe("Channel ID where the message lives"),
      ts: z.string().describe("Timestamp of the message to edit"),
      text: z.string().describe("New message text"),
    },
    async (input) => {
      try {
        await slackApi(slackConfig, "chat.update", {
          channel: input.channel,
          ts: input.ts,
          text: input.text,
        });
        await convexClient.emitEvent(agentId, "slack.message_updated", "slack_tools", {
          channel: input.channel,
          ts: input.ts,
        });
        return {
          content: [{ type: "text" as const, text: `Message ${input.ts} updated.` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to update message: ${err.message}` }],
        };
      }
    }
  );

  // ── Delete Message ──────────────────────────────────────────────────
  const deleteMessage = tool(
    "slack_delete_message",
    "Delete a message previously posted by the bot.",
    {
      channel: z.string().describe("Channel ID where the message lives"),
      ts: z.string().describe("Timestamp of the message to delete"),
    },
    async (input) => {
      try {
        await slackApi(slackConfig, "chat.delete", {
          channel: input.channel,
          ts: input.ts,
        });
        await convexClient.emitEvent(agentId, "slack.message_deleted", "slack_tools", {
          channel: input.channel,
          ts: input.ts,
        });
        return {
          content: [{ type: "text" as const, text: `Message ${input.ts} deleted.` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to delete message: ${err.message}` }],
        };
      }
    }
  );

  // ── Schedule Message ────────────────────────────────────────────────
  const scheduleMessage = tool(
    "slack_schedule_message",
    "Schedule a message to be posted to a channel at a future Unix timestamp.",
    {
      channel: z.string().describe("Channel ID or name"),
      text: z.string().describe("Message text (mrkdwn supported)"),
      post_at: z
        .number()
        .describe("Unix timestamp (seconds) when the message should be posted"),
      thread_ts: z.string().optional().describe("Optional thread timestamp to reply in"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "chat.scheduleMessage", {
          channel: input.channel,
          text: input.text,
          post_at: input.post_at,
          ...(input.thread_ts && { thread_ts: input.thread_ts }),
        });
        await convexClient.emitEvent(agentId, "slack.message_scheduled", "slack_tools", {
          channel: input.channel,
          postAt: input.post_at,
          scheduledMessageId: result.scheduled_message_id,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Message scheduled for ${new Date(input.post_at * 1000).toISOString()} (id: ${result.scheduled_message_id}).`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to schedule message: ${err.message}` }],
        };
      }
    }
  );

  // ── Get Permalink ───────────────────────────────────────────────────
  const getPermalink = tool(
    "slack_get_permalink",
    "Get a shareable permalink URL to a specific Slack message.",
    {
      channel: z.string().describe("Channel ID where the message lives"),
      message_ts: z.string().describe("Timestamp of the message"),
    },
    async (input) => {
      try {
        const result = await slackApiForm(slackConfig, "chat.getPermalink", {
          channel: input.channel,
          message_ts: input.message_ts,
        });
        return {
          content: [{ type: "text" as const, text: result.permalink }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to get permalink: ${err.message}` }],
        };
      }
    }
  );

  // ── Lookup User by Email ────────────────────────────────────────────
  const lookupUserByEmail = tool(
    "slack_lookup_user_by_email",
    "Find a Slack user by their email address. Requires users:read.email scope.",
    {
      email: z.string().describe("Email address of the user"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "users.lookupByEmail", {
          email: input.email,
        });
        const u = result.user;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: u.id,
                  name: u.name,
                  realName: u.real_name,
                  displayName: u.profile?.display_name,
                  email: u.profile?.email,
                  isBot: u.is_bot,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to lookup user: ${err.message}` }],
        };
      }
    }
  );

  // ── Pin Message ─────────────────────────────────────────────────────
  const pinMessage = tool(
    "slack_pin_message",
    "Pin a message to a channel.",
    {
      channel: z.string().describe("Channel ID"),
      timestamp: z.string().describe("Timestamp of the message to pin"),
    },
    async (input) => {
      try {
        await slackApi(slackConfig, "pins.add", {
          channel: input.channel,
          timestamp: input.timestamp,
        });
        await convexClient.emitEvent(agentId, "slack.message_pinned", "slack_tools", {
          channel: input.channel,
          ts: input.timestamp,
        });
        return {
          content: [{ type: "text" as const, text: `Message pinned in ${input.channel}.` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to pin message: ${err.message}` }],
        };
      }
    }
  );

  // ── Unpin Message ───────────────────────────────────────────────────
  const unpinMessage = tool(
    "slack_unpin_message",
    "Unpin a message from a channel.",
    {
      channel: z.string().describe("Channel ID"),
      timestamp: z.string().describe("Timestamp of the message to unpin"),
    },
    async (input) => {
      try {
        await slackApi(slackConfig, "pins.remove", {
          channel: input.channel,
          timestamp: input.timestamp,
        });
        await convexClient.emitEvent(agentId, "slack.message_unpinned", "slack_tools", {
          channel: input.channel,
          ts: input.timestamp,
        });
        return {
          content: [{ type: "text" as const, text: `Message unpinned in ${input.channel}.` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to unpin message: ${err.message}` }],
        };
      }
    }
  );

  // ── Create Channel ──────────────────────────────────────────────────
  const createChannel = tool(
    "slack_create_channel",
    "Create a new Slack channel. Channel names must be lowercase, no spaces.",
    {
      name: z
        .string()
        .describe("Channel name (lowercase, no spaces, e.g. 'project-alpha')"),
      is_private: z
        .boolean()
        .optional()
        .describe("Create as private channel (default false)"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "conversations.create", {
          name: input.name,
          is_private: input.is_private ?? false,
        });
        const ch = result.channel;
        await convexClient.emitEvent(agentId, "slack.channel_created", "slack_tools", {
          channelId: ch.id,
          name: ch.name,
          isPrivate: ch.is_private,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Channel #${ch.name} created (id: ${ch.id}).`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to create channel: ${err.message}` }],
        };
      }
    }
  );

  // ── Join Channel ────────────────────────────────────────────────────
  const joinChannel = tool(
    "slack_join_channel",
    "Bot joins a public channel so it can post and read history.",
    {
      channel: z.string().describe("Channel ID to join"),
    },
    async (input) => {
      try {
        const result = await slackApi(slackConfig, "conversations.join", {
          channel: input.channel,
        });
        await convexClient.emitEvent(agentId, "slack.channel_joined", "slack_tools", {
          channelId: result.channel?.id ?? input.channel,
          name: result.channel?.name,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Joined channel ${result.channel?.name ?? input.channel}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to join channel: ${err.message}` }],
        };
      }
    }
  );

  // ── Invite to Channel ───────────────────────────────────────────────
  const inviteToChannel = tool(
    "slack_invite_to_channel",
    "Invite one or more users to a channel.",
    {
      channel: z.string().describe("Channel ID"),
      user_ids: z
        .array(z.string())
        .describe("Array of user IDs to invite (e.g. ['U01234ABCDE'])"),
    },
    async (input) => {
      try {
        await slackApi(slackConfig, "conversations.invite", {
          channel: input.channel,
          users: input.user_ids.join(","),
        });
        await convexClient.emitEvent(agentId, "slack.users_invited", "slack_tools", {
          channel: input.channel,
          userIds: input.user_ids,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Invited ${input.user_ids.length} user(s) to ${input.channel}.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to invite users: ${err.message}` }],
        };
      }
    }
  );

  return [
    sendMessage,
    listChannels,
    readMessages,
    addReaction,
    setChannelTopic,
    searchMessages,
    searchFiles,
    searchUsers,
    listUsers,
    sendDirectMessage,
    uploadFile,
    updateMessage,
    deleteMessage,
    scheduleMessage,
    getPermalink,
    lookupUserByEmail,
    pinMessage,
    unpinMessage,
    createChannel,
    joinChannel,
    inviteToChannel,
  ];
}
