import { ConvexHttpClient } from "convex/browser";
import { api } from "@agent-maker/shared/convex/_generated/api";

export class AgentConvexClient {
  private client: ConvexHttpClient;
  private serverToken: string;

  constructor(convexUrl: string, serverToken: string) {
    this.client = new ConvexHttpClient(convexUrl);
    this.serverToken = serverToken;
  }

  // ── Queries ────────────────────────────────────────────────────────

  async getAgent(agentId: string) {
    return this.client.query(api.agentApi.getAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async listMessages(conversationId: string) {
    return this.client.query(api.agentApi.listMessages, {
      serverToken: this.serverToken,
      conversationId: conversationId as any,
    });
  }

  async listMemories(agentId: string) {
    return this.client.query(api.agentApi.listMemories, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async searchMemories(agentId: string, query: string) {
    return this.client.query(api.agentApi.searchMemories, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      query,
    });
  }

  // ── Mutations ──────────────────────────────────────────────────────

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

  async storeMemory(agentId: string, content: string, category?: string) {
    return this.client.mutation(api.agentApi.storeMemory, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      content,
      category,
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

  async setSuggestions(messageId: string, suggestions: string[]) {
    return this.client.mutation(api.agentApi.setSuggestions, {
      serverToken: this.serverToken,
      messageId: messageId as any,
      suggestions,
    });
  }

  async updateConversationTitle(conversationId: string, title: string) {
    return this.client.mutation(api.agentApi.updateConversationTitle, {
      serverToken: this.serverToken,
      conversationId: conversationId as any,
      title,
    });
  }

  async listCustomTools(agentId: string) {
    return this.client.query(api.agentApi.listCustomTools, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  // ── Page Queries ───────────────────────────────────────────────────

  async listTabs(agentId: string) {
    return this.client.query(api.agentApi.listTabs, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async listTasks(tabId: string) {
    return this.client.query(api.agentApi.listTasks, {
      serverToken: this.serverToken,
      tabId: tabId as any,
    });
  }

  async listNotes(tabId: string) {
    return this.client.query(api.agentApi.listNotes, {
      serverToken: this.serverToken,
      tabId: tabId as any,
    });
  }

  async listSpreadsheetData(tabId: string) {
    return this.client.query(api.agentApi.listSpreadsheetData, {
      serverToken: this.serverToken,
      tabId: tabId as any,
    });
  }

  // ── Page Mutations ─────────────────────────────────────────────────

  async createTask(tabId: string, agentId: string, data: {
    title: string;
    description?: string;
    status?: "todo" | "in_progress" | "done";
    priority?: "low" | "medium" | "high";
  }) {
    return this.client.mutation(api.agentApi.createTask, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      agentId: agentId as any,
      ...data,
    });
  }

  async updateTask(taskId: string, data: {
    title?: string;
    description?: string;
    status?: "todo" | "in_progress" | "done";
    priority?: "low" | "medium" | "high";
  }) {
    return this.client.mutation(api.agentApi.updateTask, {
      serverToken: this.serverToken,
      taskId: taskId as any,
      ...data,
    });
  }

  async createNote(tabId: string, agentId: string, data: {
    title: string;
    content?: string;
  }) {
    return this.client.mutation(api.agentApi.createNote, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      agentId: agentId as any,
      ...data,
    });
  }

  async updateNote(noteId: string, data: {
    title?: string;
    content?: string;
  }) {
    return this.client.mutation(api.agentApi.updateNote, {
      serverToken: this.serverToken,
      noteId: noteId as any,
      ...data,
    });
  }

  async addSpreadsheetRow(tabId: string, agentId: string, data: Record<string, any>) {
    return this.client.mutation(api.agentApi.addSpreadsheetRow, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      agentId: agentId as any,
      data,
    });
  }

  async updateSpreadsheetRow(rowId: string, data: Record<string, any>) {
    return this.client.mutation(api.agentApi.updateSpreadsheetRow, {
      serverToken: this.serverToken,
      rowId: rowId as any,
      data,
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

  async addSpreadsheetColumn(tabId: string, agentId: string, name: string, type: string) {
    return this.client.mutation(api.agentApi.addSpreadsheetColumn, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      agentId: agentId as any,
      name,
      type: type as any,
    });
  }

  async updateTabConfig(tabId: string, config: any) {
    return this.client.mutation(api.agentApi.updateTabConfig, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      config,
    });
  }

  // ── Document / RAG ──────────────────────────────────────────────────

  async searchDocumentChunks(agentId: string, embedding: number[]) {
    return this.client.action(api.agentApi.searchDocumentChunks, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      embedding,
    });
  }

  async listAgentDocuments(agentId: string) {
    return this.client.query(api.agentApi.listAgentDocuments, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async storeDocumentChunks(
    documentId: string,
    agentId: string,
    chunks: Array<{ chunkIndex: number; content: string; embedding: number[] }>
  ) {
    return this.client.mutation(api.agentApi.storeDocumentChunks, {
      serverToken: this.serverToken,
      documentId: documentId as any,
      agentId: agentId as any,
      chunks,
    });
  }

  async updateDocumentStatus(
    documentId: string,
    status: "uploading" | "processing" | "ready" | "error",
    chunkCount?: number,
    error?: string
  ) {
    return this.client.mutation(api.agentApi.updateDocumentStatus, {
      serverToken: this.serverToken,
      documentId: documentId as any,
      status,
      chunkCount,
      error,
    });
  }
}
