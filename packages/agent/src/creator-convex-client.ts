import { ConvexHttpClient } from "convex/browser";
import { api } from "@agent-maker/shared/convex/_generated/api";

// Simple in-process cache shared across creator runs (same TTL as main client).
const credentialCache = new Map<string, { value: string | null; expiresAt: number }>();
const CREDENTIAL_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Convex client for the Creator agent — talks to creatorApi endpoints.
 */
export class CreatorConvexClient {
  private client: ConvexHttpClient;
  private serverToken: string;

  constructor(convexUrl: string, serverToken: string) {
    this.client = new ConvexHttpClient(convexUrl);
    this.serverToken = serverToken;
  }

  async getAgentConfig(agentId: string) {
    return this.client.query(api.creatorApi.getAgentConfig, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async getUserPlan(agentId: string) {
    return this.client.query(api.creatorApi.getUserPlan, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async updateAgentConfig(
    agentId: string,
    updates: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      model?: string;
      enabledToolSets?: string[];
    }
  ) {
    return this.client.mutation(api.creatorApi.updateAgentConfig, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      ...updates,
    });
  }

  async finalizeAgent(agentId: string) {
    return this.client.mutation(api.creatorApi.finalizeAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async createPage(agentId: string, label: string, type: string) {
    return this.client.mutation(api.agentApi.createPage, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      label,
      type: type as any,
    });
  }

  async getSessionInfo(
    conversationId: string
  ): Promise<{ mode: "create" | "edit"; creatorModel: string | null }> {
    const session = await this.client.query(api.creatorApi.getSessionByConversation, {
      serverToken: this.serverToken,
      conversationId: conversationId as any,
    });
    return {
      mode: (session?.mode as "create" | "edit") ?? "create",
      creatorModel: session?.creatorModel ?? null,
    };
  }

  async findTabByLabel(agentId: string, label: string): Promise<string | null> {
    return this.client.query(api.agentApi.findTabByLabel, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      label,
    });
  }

  async createApiEndpoint(
    agentId: string,
    tabId: string,
    endpoint: {
      name: string;
      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      description?: string;
      promptTemplate: string;
      responseFormat?: "json" | "text";
    }
  ) {
    return this.client.mutation(api.agentApi.createApiEndpoint, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      tabId: tabId as any,
      name: endpoint.name,
      method: endpoint.method,
      description: endpoint.description,
      promptTemplate: endpoint.promptTemplate,
      responseFormat: endpoint.responseFormat,
    });
  }

  async setSuggestions(messageId: string, suggestions: string[]) {
    return this.client.mutation(api.agentApi.setSuggestions, {
      serverToken: this.serverToken,
      messageId: messageId as any,
      suggestions,
    });
  }

  async setQuestions(
    messageId: string,
    questions: Array<{ id: string; question: string; options: string[] }>
  ) {
    return this.client.mutation(api.agentApi.setQuestions, {
      serverToken: this.serverToken,
      messageId: messageId as any,
      questions,
    });
  }

  // Reuse agentApi for message streaming
  async listMessages(conversationId: string) {
    return this.client.query(api.agentApi.listMessages, {
      serverToken: this.serverToken,
      conversationId: conversationId as any,
    });
  }

  async updateMessage(
    messageId: string,
    content: string,
    status: string,
    toolCalls?: Array<{
      id: string;
      name: string;
      input: string;
      output?: string;
    }>
  ): Promise<{ stopped: boolean }> {
    const result = await this.client.mutation(api.agentApi.updateMessage, {
      serverToken: this.serverToken,
      messageId: messageId as any,
      content,
      status: status as any,
      toolCalls,
    });
    return result ?? { stopped: false };
  }

  async updateConversationTitle(conversationId: string, title: string) {
    return this.client.mutation(api.agentApi.updateConversationTitle, {
      serverToken: this.serverToken,
      conversationId: conversationId as any,
      title,
    });
  }

  /** Fetch the user's stored API key for the given AI provider type.
   * Returns null if not configured (caller falls back to server env var). */
  async getAiProviderApiKey(
    agentId: string,
    providerType: string
  ): Promise<string | null> {
    const cacheKey = `ai:${agentId}:${providerType}`;
    const cached = credentialCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    let apiKey: string | null = null;
    try {
      const result = await this.client.action(
        api.credentialActions.getAiProviderApiKey,
        {
          serverToken: this.serverToken,
          agentId: agentId as any,
          providerType,
        }
      );
      apiKey = result?.apiKey ?? null;
    } catch (err: any) {
      console.error(
        `[creator-credential] getAiProviderApiKey(${providerType}) failed:`,
        err?.message ?? err
      );
    }

    credentialCache.set(cacheKey, {
      value: apiKey,
      expiresAt: Date.now() + CREDENTIAL_CACHE_TTL_MS,
    });
    return apiKey;
  }
}
