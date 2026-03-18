import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
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

  return allowed;
}
