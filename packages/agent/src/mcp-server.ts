import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { AgentConvexClient } from "./convex-client.js";
import { createMemoryTools } from "./tools/memory-tools.js";
import { createPageTools, getPageToolNames } from "./tools/page-tools.js";
import { createCustomHttpTools } from "./tools/custom-http-tools.js";
import { createSuggestTools } from "./tools/suggest-tools.js";
import { createRagTools } from "./tools/rag-tools.js";
import { createEmailTools } from "./tools/email-tools.js";
import { createScheduleTools } from "./tools/schedule-tools.js";
import { createAutomationTools } from "./tools/automation-tools.js";
import { createTimerTools } from "./tools/timer-tools.js";
import { createWebhookManagementTools } from "./tools/webhook-management-tools.js";
import { createAgentMessageTools } from "./tools/agent-message-tools.js";
import { createNotionTools } from "./tools/notion-tools.js";
import { createSlackTools } from "./tools/slack-tools.js";
import { createDiscordTools } from "./tools/discord-tools.js";
import { createGCalTools } from "./tools/gcal-tools.js";
import { createGDriveTools } from "./tools/gdrive-tools.js";
import { createGSheetsTools } from "./tools/gsheets-tools.js";
import { createImageGenTools } from "./tools/image-gen-tools.js";
import { createGmailTools } from "./tools/gmail-tools.js";

interface Tab {
  _id: string;
  type: string;
  label: string;
}

interface CustomToolConfig {
  _id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  inputSchema?: any;
  headers?: Record<string, string>;
}

interface EmailConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName?: string;
}

interface NotionConfig {
  apiKey: string;
}

interface SlackConfig {
  botToken: string;
  defaultChannel?: string;
}

interface DiscordConfig {
  botToken: string;
  defaultChannel?: string;
}

interface GCalConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface GDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface GSheetsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface ImageGenConfig {
  provider: "gemini" | "nano_banana";
  geminiApiKey?: string;
  nanoBananaApiKey?: string;
}

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface McpServerDeps {
  convexClient: AgentConvexClient;
  agentId: string;
  messageId: string;
  conversationId?: string;
  enabledToolSets: string[];
  tabs: Tab[];
  customTools: CustomToolConfig[];
  emailConfig?: EmailConfig | null;
  notionConfig?: NotionConfig | null;
  slackConfig?: SlackConfig | null;
  discordConfig?: DiscordConfig | null;
  gcalConfig?: GCalConfig | null;
  gdriveConfig?: GDriveConfig | null;
  gsheetsConfig?: GSheetsConfig | null;
  imageGenConfig?: ImageGenConfig | null;
  imageGenModel?: string | null;
  gmailConfig?: GmailConfig | null;
  onToolProgress?: (toolName: string, progress: string) => void;
  isDiscordConversation?: boolean;
}

function has(enabledToolSets: string[], name: string): boolean {
  return enabledToolSets.includes(name);
}

/**
 * Builds an MCP server with tools dynamically loaded based on the agent's
 * enabledToolSets, existing page tabs, and custom HTTP tools.
 */
export function buildMcpServer(deps: McpServerDeps) {
  const tools: any[] = [];
  const enabled = deps.enabledToolSets;

  // Memory tools — gated by "memory"
  if (has(enabled, "memory")) {
    tools.push(...createMemoryTools(deps.convexClient, deps.agentId));
  }

  // Page tools — gated by "pages"
  if (has(enabled, "pages")) {
    tools.push(
      ...createPageTools(deps.convexClient, deps.agentId, deps.tabs)
    );
  }

  // Suggest replies & questions (always included — core UX, not a capability)
  tools.push(...createSuggestTools(deps.convexClient, deps.messageId));

  // RAG / Knowledge Base tools — gated by "rag"
  if (has(enabled, "rag")) {
    tools.push(...createRagTools(deps.convexClient, deps.agentId));
  }

  // Email tools — gated by "email"
  if (has(enabled, "email") && deps.emailConfig) {
    tools.push(
      ...createEmailTools(deps.convexClient, deps.agentId, deps.emailConfig)
    );
  }

  // Custom HTTP tools — gated by "custom_http_tools"
  if (has(enabled, "custom_http_tools") && deps.customTools.length > 0) {
    tools.push(...createCustomHttpTools(deps.customTools));
  }

  // Scheduled Actions — gated by "schedules"
  if (has(enabled, "schedules")) {
    tools.push(...createScheduleTools(deps.convexClient, deps.agentId));
  }

  // Automations — gated by "automations"
  if (has(enabled, "automations")) {
    tools.push(...createAutomationTools(deps.convexClient, deps.agentId));
  }

  // Timers / Delayed Actions — gated by "timers"
  if (has(enabled, "timers")) {
    tools.push(
      ...createTimerTools(deps.convexClient, deps.agentId, deps.conversationId)
    );
  }

  // Webhooks (outgoing + event bus) — gated by "webhooks"
  if (has(enabled, "webhooks")) {
    tools.push(
      ...createWebhookManagementTools(deps.convexClient, deps.agentId)
    );
  }

  // Inter-Agent Messaging — gated by "agent_messages"
  if (has(enabled, "agent_messages")) {
    tools.push(
      ...createAgentMessageTools(deps.convexClient, deps.agentId)
    );
  }

  // Notion — gated by "notion"
  if (has(enabled, "notion") && deps.notionConfig) {
    tools.push(
      ...createNotionTools(deps.convexClient, deps.agentId, deps.notionConfig)
    );
  }

  // Slack — gated by "slack"
  if (has(enabled, "slack") && deps.slackConfig) {
    tools.push(
      ...createSlackTools(deps.convexClient, deps.agentId, deps.slackConfig)
    );
  }

  // Discord — gated by "discord"
  if (has(enabled, "discord") && deps.discordConfig) {
    tools.push(
      ...createDiscordTools(deps.convexClient, deps.agentId, deps.discordConfig)
    );
  }

  // Discord channel history recall — available when conversation is Discord-sourced
  if (deps.isDiscordConversation && deps.conversationId) {
    const convexClient = deps.convexClient;
    const conversationId = deps.conversationId;
    tools.push(
      tool(
        "recall_channel_history",
        "Load older messages from this channel (Discord or Slack) beyond the 24-hour context window. Use this when the user references something from a previous day or you need deeper conversation history.",
        {
          hours_ago: z.number().default(48).describe("How many hours back to look (from now). Default 48."),
          limit: z.number().default(50).describe("Max number of messages to retrieve. Default 50."),
        },
        async (input) => {
          const beforeTimestamp = Date.now() - (input.hours_ago * 60 * 60 * 1000);
          const messages = await convexClient.listOlderMessages(conversationId, beforeTimestamp, input.limit);
          if (!messages || messages.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No older messages found in this time range." }],
            };
          }
          const formatted = messages.map((m: any) =>
            `[${new Date(m._creationTime).toLocaleString()}] ${m.role}: ${m.content?.slice(0, 500) ?? "(empty)"}`
          ).join("\n\n");
          return {
            content: [{ type: "text" as const, text: `Found ${messages.length} older messages:\n\n${formatted}` }],
          };
        }
      )
    );
  }

  // Google Calendar — gated by "google_calendar"
  if (has(enabled, "google_calendar") && deps.gcalConfig) {
    tools.push(
      ...createGCalTools(deps.convexClient, deps.agentId, deps.gcalConfig)
    );
  }

  // Google Drive — gated by "google_drive"
  if (has(enabled, "google_drive") && deps.gdriveConfig) {
    tools.push(
      ...createGDriveTools(deps.convexClient, deps.agentId, deps.gdriveConfig)
    );
  }

  // Google Sheets — gated by "google_sheets"
  if (has(enabled, "google_sheets") && deps.gsheetsConfig) {
    tools.push(
      ...createGSheetsTools(deps.convexClient, deps.agentId, deps.gsheetsConfig)
    );
  }

  // Gmail — gated by "gmail"
  if (has(enabled, "gmail") && deps.gmailConfig) {
    tools.push(
      ...createGmailTools(deps.convexClient, deps.agentId, deps.gmailConfig)
    );
  }

  // Image Generation — gated by "image_generation"
  if (has(enabled, "image_generation")) {
    tools.push(
      ...createImageGenTools(
        deps.convexClient,
        deps.agentId,
        deps.imageGenConfig ?? { provider: "gemini" as const },
        deps.imageGenModel ?? undefined,
        deps.onToolProgress
      )
    );
  }

  return createSdkMcpServer({
    name: "agent-tools",
    version: "1.0.0",
    tools,
  });
}

/**
 * Returns the list of allowed tool names for the Claude SDK,
 * filtered by the agent's enabledToolSets.
 */
export function buildAllowedTools(
  enabledToolSets: string[],
  tabs: Tab[],
  customTools: CustomToolConfig[] = []
): string[] {
  const allowed: string[] = [];

  // Web search & fetch — gated by "web_search"
  if (has(enabledToolSets, "web_search")) {
    allowed.push("WebSearch", "WebFetch");
  }

  // Memory tools — gated by "memory"
  if (has(enabledToolSets, "memory")) {
    allowed.push(
      "mcp__agent-tools__store_memory",
      "mcp__agent-tools__recall_memory",
      "mcp__agent-tools__search_memories"
    );
  }

  // Page tools — gated by "pages"
  if (has(enabledToolSets, "pages")) {
    allowed.push(...getPageToolNames(tabs));
  }

  // Suggest replies & questions (always — core UX)
  allowed.push(
    "mcp__agent-tools__suggest_replies",
    "mcp__agent-tools__ask_questions"
  );

  // RAG / Knowledge Base tools — gated by "rag"
  if (has(enabledToolSets, "rag")) {
    allowed.push("mcp__agent-tools__search_documents");
  }

  // Email tools — gated by "email"
  if (has(enabledToolSets, "email")) {
    allowed.push("mcp__agent-tools__send_email");
  }

  // Custom HTTP tools — gated by "custom_http_tools"
  if (has(enabledToolSets, "custom_http_tools")) {
    for (const ct of customTools) {
      allowed.push(`mcp__agent-tools__custom_${ct.name}`);
    }
  }

  // Scheduled Actions — gated by "schedules"
  if (has(enabledToolSets, "schedules")) {
    allowed.push(
      "mcp__agent-tools__create_schedule",
      "mcp__agent-tools__list_schedules",
      "mcp__agent-tools__pause_schedule",
      "mcp__agent-tools__resume_schedule",
      "mcp__agent-tools__delete_schedule"
    );
  }

  // Automations — gated by "automations"
  if (has(enabledToolSets, "automations")) {
    allowed.push(
      "mcp__agent-tools__create_automation",
      "mcp__agent-tools__list_automations",
      "mcp__agent-tools__delete_automation"
    );
  }

  // Timers — gated by "timers"
  if (has(enabledToolSets, "timers")) {
    allowed.push(
      "mcp__agent-tools__set_timer",
      "mcp__agent-tools__list_timers",
      "mcp__agent-tools__cancel_timer"
    );
  }

  // Webhooks — gated by "webhooks"
  if (has(enabledToolSets, "webhooks")) {
    allowed.push(
      "mcp__agent-tools__fire_webhook",
      "mcp__agent-tools__list_events"
    );
  }

  // Inter-Agent Messaging — gated by "agent_messages"
  if (has(enabledToolSets, "agent_messages")) {
    allowed.push(
      "mcp__agent-tools__list_sibling_agents",
      "mcp__agent-tools__send_to_agent",
      "mcp__agent-tools__check_agent_messages",
      "mcp__agent-tools__respond_to_agent"
    );
  }

  // Notion — gated by "notion"
  if (has(enabledToolSets, "notion")) {
    allowed.push(
      "mcp__agent-tools__notion_search",
      "mcp__agent-tools__notion_query_database",
      "mcp__agent-tools__notion_create_page",
      "mcp__agent-tools__notion_update_page",
      "mcp__agent-tools__notion_get_page",
      "mcp__agent-tools__notion_append_blocks"
    );
  }

  // Slack — gated by "slack"
  if (has(enabledToolSets, "slack")) {
    allowed.push(
      "mcp__agent-tools__slack_send_message",
      "mcp__agent-tools__slack_list_channels",
      "mcp__agent-tools__slack_read_messages",
      "mcp__agent-tools__slack_add_reaction",
      "mcp__agent-tools__slack_set_topic",
      "mcp__agent-tools__slack_search_messages",
      "mcp__agent-tools__slack_search_files",
      "mcp__agent-tools__slack_search_users",
      "mcp__agent-tools__slack_list_users",
      "mcp__agent-tools__slack_send_dm",
      "mcp__agent-tools__slack_upload_file",
      "mcp__agent-tools__slack_update_message",
      "mcp__agent-tools__slack_delete_message",
      "mcp__agent-tools__slack_schedule_message",
      "mcp__agent-tools__slack_get_permalink",
      "mcp__agent-tools__slack_lookup_user_by_email",
      "mcp__agent-tools__slack_pin_message",
      "mcp__agent-tools__slack_unpin_message",
      "mcp__agent-tools__slack_create_channel",
      "mcp__agent-tools__slack_join_channel",
      "mcp__agent-tools__slack_invite_to_channel",
      "mcp__agent-tools__slack_authorize_user",
      "mcp__agent-tools__slack_deauthorize_user",
      "mcp__agent-tools__slack_list_authorized_users"
    );
  }

  // Discord — gated by "discord"
  if (has(enabledToolSets, "discord")) {
    allowed.push(
      "mcp__agent-tools__discord_send_message",
      "mcp__agent-tools__discord_list_guilds",
      "mcp__agent-tools__discord_list_channels",
      "mcp__agent-tools__discord_read_messages",
      "mcp__agent-tools__discord_add_reaction",
      "mcp__agent-tools__discord_create_thread",
      "mcp__agent-tools__discord_reply_in_thread",
      "mcp__agent-tools__recall_channel_history"
    );
  }

  // Google Calendar — gated by "google_calendar"
  if (has(enabledToolSets, "google_calendar")) {
    allowed.push(
      "mcp__agent-tools__gcal_list_calendars",
      "mcp__agent-tools__gcal_list_events",
      "mcp__agent-tools__gcal_create_event",
      "mcp__agent-tools__gcal_update_event",
      "mcp__agent-tools__gcal_delete_event",
      "mcp__agent-tools__gcal_find_free_time"
    );
  }

  // Google Drive — gated by "google_drive"
  if (has(enabledToolSets, "google_drive")) {
    allowed.push(
      "mcp__agent-tools__gdrive_search",
      "mcp__agent-tools__gdrive_list_files",
      "mcp__agent-tools__gdrive_read_file",
      "mcp__agent-tools__gdrive_create_file",
      "mcp__agent-tools__gdrive_move_file",
      "mcp__agent-tools__gdrive_delete_file"
    );
  }

  // Google Sheets — gated by "google_sheets"
  if (has(enabledToolSets, "google_sheets")) {
    allowed.push(
      "mcp__agent-tools__gsheets_list_spreadsheets",
      "mcp__agent-tools__gsheets_create",
      "mcp__agent-tools__gsheets_get_info",
      "mcp__agent-tools__gsheets_read",
      "mcp__agent-tools__gsheets_write",
      "mcp__agent-tools__gsheets_append",
      "mcp__agent-tools__gsheets_clear"
    );
  }

  // Gmail — gated by "gmail"
  if (has(enabledToolSets, "gmail")) {
    allowed.push(
      "mcp__agent-tools__gmail_list_messages",
      "mcp__agent-tools__gmail_search",
      "mcp__agent-tools__gmail_get_message",
      "mcp__agent-tools__gmail_send",
      "mcp__agent-tools__gmail_reply",
      "mcp__agent-tools__gmail_list_labels",
      "mcp__agent-tools__gmail_modify_labels",
      "mcp__agent-tools__gmail_get_thread"
    );
  }

  // Image Generation — gated by "image_generation"
  if (has(enabledToolSets, "image_generation")) {
    allowed.push(
      "mcp__agent-tools__generate_image",
      "mcp__agent-tools__list_assets"
    );
  }

  return allowed;
}
