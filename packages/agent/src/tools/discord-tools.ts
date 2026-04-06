import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "../convex-client.js";

export interface DiscordConfig {
  botToken: string;
  defaultChannel?: string;
}

const DISCORD_BASE = "https://discord.com/api/v10";

async function discordApi(
  config: DiscordConfig,
  method: string,
  path: string,
  body?: Record<string, any>
) {
  const res = await fetch(`${DISCORD_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${config.botToken}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error (${res.status}): ${text}`);
  }

  // 204 No Content
  if (res.status === 204) return {};
  return res.json();
}

export function createDiscordTools(
  convexClient: AgentConvexClient,
  agentId: string,
  discordConfig: DiscordConfig
) {
  // ── Send Message ────────────────────────────────────────────────────
  const sendMessage = tool(
    "discord_send_message",
    "Send a message to a Discord channel. Supports markdown formatting.",
    {
      channel_id: z
        .string()
        .describe("Discord channel ID"),
      content: z
        .string()
        .describe("Message content (supports Discord markdown)"),
    },
    async (input) => {
      try {
        const result = await discordApi(discordConfig, "POST", `/channels/${input.channel_id}/messages`, {
          content: input.content,
        });

        await convexClient.emitEvent(agentId, "discord.message_sent", "discord_tools", {
          channelId: input.channel_id,
          content: input.content,
          messageId: result.id,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Message sent to channel ${input.channel_id}. Message ID: ${result.id}`,
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

  // ── List Guilds ─────────────────────────────────────────────────────
  const listGuilds = tool(
    "discord_list_guilds",
    "List the Discord servers (guilds) the bot is a member of.",
    {},
    async () => {
      try {
        const guilds = await discordApi(discordConfig, "GET", "/users/@me/guilds");

        const result = (guilds as any[]).map((g: any) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          owner: g.owner,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to list guilds: ${err.message}` }],
        };
      }
    }
  );

  // ── List Channels ───────────────────────────────────────────────────
  const listChannels = tool(
    "discord_list_channels",
    "List channels in a Discord server (guild). Use this to find channel IDs before sending messages.",
    {
      guild_id: z.string().describe("Discord server (guild) ID"),
    },
    async (input) => {
      try {
        const channels = await discordApi(discordConfig, "GET", `/guilds/${input.guild_id}/channels`);

        const result = (channels as any[])
          .filter((ch: any) => ch.type === 0 || ch.type === 2 || ch.type === 5 || ch.type === 15)
          .map((ch: any) => ({
            id: ch.id,
            name: ch.name,
            type: ch.type === 0 ? "text" : ch.type === 2 ? "voice" : ch.type === 5 ? "announcement" : "forum",
            topic: ch.topic || "",
            parentId: ch.parent_id,
          }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
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
    "discord_read_messages",
    "Read recent messages from a Discord channel. Returns messages with author, content, timestamp, and attachments.",
    {
      channel_id: z.string().describe("Channel ID"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of messages to fetch (default 20)"),
    },
    async (input) => {
      try {
        const limit = input.limit ?? 20;
        const messages = await discordApi(discordConfig, "GET", `/channels/${input.channel_id}/messages?limit=${limit}`);

        const result = (messages as any[]).map((msg: any) => ({
          id: msg.id,
          author: msg.author?.username ?? "unknown",
          content: msg.content,
          timestamp: msg.timestamp,
          attachments: (msg.attachments ?? []).map((a: any) => a.url),
          referencedMessage: msg.referenced_message?.id,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
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
    "discord_add_reaction",
    "Add an emoji reaction to a message in Discord.",
    {
      channel_id: z.string().describe("Channel ID"),
      message_id: z.string().describe("Message ID to react to"),
      emoji: z
        .string()
        .describe("Emoji — use Unicode (e.g. '👍') or custom format 'name:id' (e.g. 'myemoji:123456')"),
    },
    async (input) => {
      try {
        const encoded = encodeURIComponent(input.emoji);
        await discordApi(
          discordConfig,
          "PUT",
          `/channels/${input.channel_id}/messages/${input.message_id}/reactions/${encoded}/@me`
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Reaction ${input.emoji} added to message ${input.message_id}.`,
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

  // ── Create Thread ───────────────────────────────────────────────────
  const createThread = tool(
    "discord_create_thread",
    "Create a new thread in a Discord channel. Can be attached to an existing message or standalone.",
    {
      channel_id: z.string().describe("Channel ID to create thread in"),
      name: z.string().describe("Thread name"),
      message_id: z
        .string()
        .optional()
        .describe("Message ID to start thread from (omit for standalone thread)"),
      auto_archive_duration: z
        .number()
        .optional()
        .describe("Auto-archive after minutes of inactivity: 60, 1440, 4320, or 10080 (default 1440)"),
    },
    async (input) => {
      try {
        let result;
        if (input.message_id) {
          result = await discordApi(
            discordConfig,
            "POST",
            `/channels/${input.channel_id}/messages/${input.message_id}/threads`,
            {
              name: input.name,
              auto_archive_duration: input.auto_archive_duration ?? 1440,
            }
          );
        } else {
          result = await discordApi(
            discordConfig,
            "POST",
            `/channels/${input.channel_id}/threads`,
            {
              name: input.name,
              type: 11, // PUBLIC_THREAD
              auto_archive_duration: input.auto_archive_duration ?? 1440,
            }
          );
        }

        await convexClient.emitEvent(agentId, "discord.thread_created", "discord_tools", {
          channelId: input.channel_id,
          threadId: result.id,
          threadName: input.name,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Thread "${input.name}" created. Thread ID: ${result.id}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to create thread: ${err.message}` }],
        };
      }
    }
  );

  // ── Reply in Thread ─────────────────────────────────────────────────
  const replyInThread = tool(
    "discord_reply_in_thread",
    "Send a message in a Discord thread. Threads are channels, so provide the thread ID as channel_id.",
    {
      thread_id: z.string().describe("Thread (channel) ID"),
      content: z.string().describe("Message content"),
    },
    async (input) => {
      try {
        const result = await discordApi(discordConfig, "POST", `/channels/${input.thread_id}/messages`, {
          content: input.content,
        });

        await convexClient.emitEvent(agentId, "discord.message_sent", "discord_tools", {
          channelId: input.thread_id,
          content: input.content,
          messageId: result.id,
          isThread: true,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Reply sent in thread. Message ID: ${result.id}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to reply in thread: ${err.message}` }],
        };
      }
    }
  );

  return [
    sendMessage,
    listGuilds,
    listChannels,
    readMessages,
    addReaction,
    createThread,
    replyInThread,
  ];
}
