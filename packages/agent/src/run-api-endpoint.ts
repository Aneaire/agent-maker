import type { CoreMessage } from "ai";
import { AgentConvexClient } from "./convex-client.js";
import { buildMcpServer } from "./mcp-server.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { generateText, stepCountIs } from "ai";
import {
  getLanguageModel,
  providerTypeForModel,
  assertProviderCredentialAvailable,
} from "./model-factory.js";

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
  const convexClient = new AgentConvexClient(
    params.convexUrl,
    params.serverToken
  );

  const agent = await convexClient.getAgent(params.agentId);
  if (!agent) throw new Error("Agent not found");

  const effectiveModel = params.model || agent.model || "gemini-3-flash-preview";

  const tabs = (await convexClient.listTabs(params.agentId)) ?? [];
  const customTools = (await convexClient.listCustomTools(params.agentId)) ?? [];
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

  const googleApiKey = await convexClient.getAiProviderApiKey(
    params.agentId,
    "google_ai"
  );

  const { tools } = buildMcpServer({
    convexClient,
    agentId: params.agentId,
    enabledToolSets: agent.enabledToolSets,
    tabs: tabs as any,
    customTools: customTools as any,
    googleApiKey,
  });

  const toolsArg = Object.keys(tools).length > 0 ? tools : undefined;

  const providerType = providerTypeForModel(effectiveModel);
  const byokApiKey = providerType
    ? await convexClient.getAiProviderApiKey(params.agentId, providerType)
    : null;
  assertProviderCredentialAvailable(effectiveModel, byokApiKey);

  console.log(`[api] Running API endpoint for agent="${agent.name}" model="${effectiveModel}"`);

  const messages: CoreMessage[] = [{ role: "user", content: params.prompt }];

  const result = await generateText({
    model: getLanguageModel(effectiveModel, { apiKey: byokApiKey }),
    system: systemPrompt,
    messages,
    ...(toolsArg ? { tools: toolsArg } : {}),
    ...(toolsArg ? { stopWhen: stepCountIs(5) } : {}),
  });

  const responseText = result.text ?? "";

  console.log(
    `[api] API endpoint complete for agent="${agent.name}" (${responseText.length} chars)`
  );

  return responseText;
}
