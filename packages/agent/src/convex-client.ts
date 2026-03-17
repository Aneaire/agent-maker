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

  // ── Webhooks ──────────────────────────────────────────────────────

  async createTaskViaWebhook(tabId: string, agentId: string, data: {
    title: string;
    description?: string;
    status?: string;
    priority?: "low" | "medium" | "high";
  }) {
    return this.client.mutation(api.agentApi.createTaskViaWebhook, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      agentId: agentId as any,
      ...data,
    });
  }

  async updateTaskViaWebhook(taskId: string, data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: "low" | "medium" | "high";
  }) {
    return this.client.mutation(api.agentApi.updateTaskViaWebhook, {
      serverToken: this.serverToken,
      taskId: taskId as any,
      ...data,
    });
  }

  async listOutgoingWebhooks(tabId: string, event: string) {
    return this.client.query(api.agentApi.listOutgoingWebhooks, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      event,
    });
  }

  // ── Email ─────────────────────────────────────────────────────────

  async logEmail(agentId: string, data: {
    to: string[];
    subject: string;
    status: "sent" | "failed";
    resendId?: string;
    error?: string;
  }) {
    return this.client.mutation(api.agentApi.logEmail, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      ...data,
    });
  }

  async getToolConfig(agentId: string, toolSetName: string) {
    return this.client.query(api.agentApi.getToolConfig, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      toolSetName,
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

  // ── Scheduled Actions ─────────────────────────────────────────────

  async createSchedule(agentId: string, data: {
    name: string;
    description?: string;
    schedule: string;
    scheduleType: "cron" | "interval" | "once";
    action: { type: string; config: any };
    maxRuns?: number;
  }) {
    return this.client.mutation(api.scheduledActions.createFromAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      name: data.name,
      description: data.description,
      schedule: data.schedule,
      scheduleType: data.scheduleType,
      action: data.action as any,
      maxRuns: data.maxRuns,
    });
  }

  async listSchedules(agentId: string) {
    return this.client.query(api.scheduledActions.listForAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async pauseSchedule(actionId: string) {
    return this.client.mutation(api.scheduledActions.pauseFromAgent, {
      serverToken: this.serverToken,
      actionId: actionId as any,
    });
  }

  async resumeSchedule(actionId: string) {
    return this.client.mutation(api.scheduledActions.resumeFromAgent, {
      serverToken: this.serverToken,
      actionId: actionId as any,
    });
  }

  async deleteSchedule(actionId: string) {
    return this.client.mutation(api.scheduledActions.deleteFromAgent, {
      serverToken: this.serverToken,
      actionId: actionId as any,
    });
  }

  // ── Automations ───────────────────────────────────────────────────

  async createAutomation(agentId: string, data: {
    name: string;
    description?: string;
    trigger: { event: string; filter?: any };
    actions: Array<{ type: string; config: any }>;
  }) {
    return this.client.mutation(api.automations.createFromAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      actions: data.actions as any,
    });
  }

  async listAutomations(agentId: string) {
    return this.client.query(api.automations.listForAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async deleteAutomation(automationId: string) {
    return this.client.mutation(api.automations.deleteFromAgent, {
      serverToken: this.serverToken,
      automationId: automationId as any,
    });
  }

  // ── Timers ────────────────────────────────────────────────────────

  async createTimer(agentId: string, data: {
    conversationId?: string;
    label: string;
    delayMs: number;
    action: { type: string; config: any };
  }) {
    return this.client.mutation(api.agentTimers.create, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      conversationId: data.conversationId as any,
      label: data.label,
      delayMs: data.delayMs,
      action: data.action as any,
    });
  }

  async listTimers(agentId: string) {
    return this.client.query(api.agentTimers.listForAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async cancelTimer(timerId: string) {
    return this.client.mutation(api.agentTimers.cancel, {
      serverToken: this.serverToken,
      timerId: timerId as any,
    });
  }

  // ── Events ────────────────────────────────────────────────────────

  async emitEvent(agentId: string, event: string, source: string, payload: any) {
    return this.client.mutation(api.agentEvents.emit, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      event,
      source,
      payload,
    });
  }

  async listEvents(agentId: string, event?: string, limit?: number) {
    return this.client.query(api.agentEvents.listForAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      event,
      limit,
    });
  }

  // ── Inter-Agent Messaging ─────────────────────────────────────────

  async listSiblingAgents(agentId: string) {
    return this.client.query(api.agentMessages.listSiblingAgents, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async sendAgentMessage(fromAgentId: string, toAgentId: string, content: string, context?: any) {
    return this.client.mutation(api.agentMessages.send, {
      serverToken: this.serverToken,
      fromAgentId: fromAgentId as any,
      toAgentId: toAgentId as any,
      content,
      context,
    });
  }

  async listPendingAgentMessages(agentId: string) {
    return this.client.query(api.agentMessages.listPending, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async respondToAgentMessage(messageId: string, response: string) {
    return this.client.mutation(api.agentMessages.markProcessed, {
      serverToken: this.serverToken,
      messageId: messageId as any,
      response,
    });
  }
}
