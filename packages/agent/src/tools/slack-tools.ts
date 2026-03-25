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

  return [
    sendMessage,
    listChannels,
    readMessages,
    addReaction,
    setChannelTopic,
    searchMessages,
  ];
}
