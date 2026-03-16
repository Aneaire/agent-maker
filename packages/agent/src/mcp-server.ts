import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import type { AgentConvexClient } from "./convex-client.js";
import { createMemoryTools } from "./tools/memory-tools.js";
import { createPageTools, getPageToolNames } from "./tools/page-tools.js";
import { createCustomHttpTools } from "./tools/custom-http-tools.js";
import { createSuggestTools } from "./tools/suggest-tools.js";

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

interface McpServerDeps {
  convexClient: AgentConvexClient;
  agentId: string;
  messageId: string;
  enabledToolSets: string[];
  tabs: Tab[];
  customTools: CustomToolConfig[];
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

  // Custom HTTP tools — gated by "custom_http_tools"
  if (has(enabled, "custom_http_tools") && deps.customTools.length > 0) {
    tools.push(...createCustomHttpTools(deps.customTools));
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

  // Custom HTTP tools — gated by "custom_http_tools"
  if (has(enabledToolSets, "custom_http_tools")) {
    for (const ct of customTools) {
      allowed.push(`mcp__agent-tools__custom_${ct.name}`);
    }
  }

  return allowed;
}
