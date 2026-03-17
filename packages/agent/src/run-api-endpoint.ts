import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync } from "fs";
import { AgentConvexClient } from "./convex-client.js";
import { buildMcpServer, buildAllowedTools } from "./mcp-server.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { isGeminiModel } from "./run-agent.js";
import { runGeminiApiEndpoint } from "./run-gemini-agent.js";

export interface RunApiEndpointParams {
  agentId: string;
  prompt: string;
  convexUrl: string;
  serverToken: string;
  model?: string;
}

/**
 * Runs an agent synchronously for an API endpoint call.
 * Returns the final text response (no streaming, no conversation storage).
 */
export async function runApiEndpoint(
  params: RunApiEndpointParams
): Promise<string> {
  // Route to Gemini if the model is a Gemini model
  const effectiveModel = params.model || "";
  if (isGeminiModel(effectiveModel)) {
    return runGeminiApiEndpoint(params);
  }

  const convexClient = new AgentConvexClient(
    params.convexUrl,
    params.serverToken
  );

  // Load agent config
  const agent = await convexClient.getAgent(params.agentId);
  if (!agent) throw new Error("Agent not found");

  // Check if agent's default model is Gemini
  if (isGeminiModel(agent.model || "")) {
    return runGeminiApiEndpoint(params);
  }

  // Load context
  const tabs = (await convexClient.listTabs(params.agentId)) ?? [];
  const customTools =
    (await convexClient.listCustomTools(params.agentId)) ?? [];
  const memories = (await convexClient.listMemories(params.agentId)) ?? [];

  const systemPrompt = buildSystemPrompt(
    {
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      description: agent.description,
      enabledToolSets: agent.enabledToolSets,
    },
    memories,
    tabs as any,
    (customTools as any[]).map((t: any) => t.name)
  );

  const mcpServer = buildMcpServer({
    convexClient,
    agentId: params.agentId,
    enabledToolSets: agent.enabledToolSets,
    tabs: tabs as any,
    customTools: customTools as any,
  });

  const allowedTools = buildAllowedTools(
    agent.enabledToolSets,
    tabs as any,
    customTools as any
  );

  const agentCwd = `/tmp/agent-api-workspace`;
  if (!existsSync(agentCwd)) {
    mkdirSync(agentCwd, { recursive: true });
  }

  console.log(
    `[api] Running API endpoint for agent="${agent.name}"`
  );

  let responseText = "";

  const agentStream = query({
    prompt: params.prompt,
    options: {
      systemPrompt,
      cwd: agentCwd,
      mcpServers: { "agent-tools": mcpServer },
      allowedTools,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 5,
      model: params.model || agent.model || "claude-sonnet-4-6",
      stderr: (data: string) => {
        console.error("[api] CLI stderr:", data);
      },
    },
  });

  for await (const message of agentStream) {
    if (message.type === "stream_event") {
      const event = (message as any).event;
      if (
        event?.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        responseText += event.delta.text;
      }
    } else if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if ("text" in block && block.text) {
          // Use the last complete assistant text
          responseText = block.text;
        }
      }
    } else if (message.type === "result") {
      if (!responseText && (message as any).subtype === "success") {
        responseText = (message as any).result ?? "";
      }
    }
  }

  console.log(
    `[api] API endpoint complete for agent="${agent.name}" (${responseText.length} chars)`
  );

  return responseText;
}
