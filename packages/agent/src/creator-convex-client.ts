import { ConvexHttpClient } from "convex/browser";
import { api } from "@agent-maker/shared/convex/_generated/api";

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
}
