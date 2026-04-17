import { ConvexHttpClient } from "convex/browser";
import { api } from "@agent-maker/shared/convex/_generated/api";

// In-memory credential cache shared across all client instances
const credentialCache = new Map<string, { value: any; expiresAt: number }>();
const CREDENTIAL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

  async getAttachmentUrl(storageId: string): Promise<string | null> {
    return this.client.query(api.agentApi.getAttachmentUrl, {
      serverToken: this.serverToken,
      storageId: storageId as any,
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
      progress?: string;
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

  async storeMemory(agentId: string, content: string, category?: string, embedding?: number[]) {
    return this.client.mutation(api.agentApi.storeMemory, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      content,
      category,
      embedding,
    });
  }

  async searchMemoriesVector(agentId: string, embedding: number[], limit?: number) {
    return this.client.action(api.agentApi.searchMemoriesVector, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      embedding,
      limit,
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

  async listTasks(
    tabId: string,
    opts: { limit?: number; offset?: number } = {}
  ) {
    return this.client.query(api.agentApi.listTasks, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      limit: opts.limit,
      offset: opts.offset,
    });
  }

  async listNotes(tabId: string) {
    return this.client.query(api.agentApi.listNotes, {
      serverToken: this.serverToken,
      tabId: tabId as any,
    });
  }

  async listSpreadsheetData(
    tabId: string,
    opts: { rowLimit?: number; rowOffset?: number } = {}
  ) {
    return this.client.query(api.agentApi.listSpreadsheetData, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      rowLimit: opts.rowLimit,
      rowOffset: opts.rowOffset,
    });
  }

  async getTabContent(tabId: string) {
    return this.client.query(api.agentApi.getTabContent, {
      serverToken: this.serverToken,
      tabId: tabId as any,
    });
  }

  // ── API Endpoints (server-auth) ────────────────────────────────────
  async listApiEndpoints(tabId: string) {
    return this.client.query(api.agentApi.listApiEndpoints, {
      serverToken: this.serverToken,
      tabId: tabId as any,
    });
  }

  async listApiKeysForAgent(agentId: string) {
    return this.client.query(api.agentApi.listApiKeysForAgent, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async createApiEndpoint(
    tabId: string,
    agentId: string,
    data: {
      name: string;
      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      description?: string;
      promptTemplate: string;
      responseFormat?: "json" | "text";
      isActive?: boolean;
      allowedToolSets?: string[];
      inputSchema?: any;
    }
  ) {
    return this.client.mutation(api.agentApi.createApiEndpoint, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      agentId: agentId as any,
      ...data,
    });
  }

  async updateApiEndpoint(
    endpointId: string,
    data: {
      name?: string;
      method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      description?: string;
      promptTemplate?: string;
      responseFormat?: "json" | "text";
      isActive?: boolean;
      allowedToolSets?: string[];
      inputSchema?: any;
    }
  ) {
    return this.client.mutation(api.agentApi.updateApiEndpoint, {
      serverToken: this.serverToken,
      endpointId: endpointId as any,
      ...data,
    });
  }

  async toggleApiEndpoint(endpointId: string, isActive: boolean) {
    return this.client.mutation(api.agentApi.toggleApiEndpoint, {
      serverToken: this.serverToken,
      endpointId: endpointId as any,
      isActive,
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

  async getTask(taskId: string) {
    return this.client.query(api.agentApi.getTask, {
      serverToken: this.serverToken,
      taskId: taskId as any,
    });
  }

  async getNote(noteId: string) {
    return this.client.query(api.agentApi.getNote, {
      serverToken: this.serverToken,
      noteId: noteId as any,
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

  async addSpreadsheetRows(
    tabId: string,
    agentId: string,
    rows: Record<string, any>[]
  ) {
    return this.client.mutation(api.agentApi.addSpreadsheetRows, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      agentId: agentId as any,
      rows,
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

  async addSpreadsheetColumns(
    tabId: string,
    agentId: string,
    columns: Array<{ name: string; type: "text" | "number" | "date" | "checkbox" }>
  ) {
    return this.client.mutation(api.agentApi.addSpreadsheetColumns, {
      serverToken: this.serverToken,
      tabId: tabId as any,
      agentId: agentId as any,
      columns,
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

  /**
   * Try the new credential system first, fall back to legacy agentToolConfigs.
   * Results are cached for 5 minutes to avoid redundant decryption on every turn.
   */
  async getCredentialForToolSet(agentId: string, toolSetName: string) {
    const cacheKey = `${agentId}:${toolSetName}`;
    const cached = credentialCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    let result: any = null;
    try {
      const linked = await this.client.action(api.credentialActions.getDecryptedForAgent, {
        serverToken: this.serverToken,
        agentId: agentId as any,
        toolSetName,
      });
      if (linked) {
        result = linked;
      }
    } catch (err: any) {
      console.error(`[credential] getDecryptedForAgent failed for ${toolSetName}:`, err?.message ?? err);
      // New credential system not available — fall through to legacy
    }

    if (!result) {
      result = await this.getToolConfig(agentId, toolSetName);
      if (result) {
        console.log(`[credential] using legacy config for ${toolSetName}`);
      } else {
        console.warn(`[credential] no credential found for ${toolSetName} (agentId: ${agentId})`);
      }
    }

    if (result) {
      credentialCache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + CREDENTIAL_CACHE_TTL_MS,
      });
    }

    return result;
  }

  /**
   * Fetch the user's stored API key for the given AI provider type
   * ("anthropic" | "google_ai" | "openai"). Returns null if the user has not
   * configured that credential (caller should then fall back to server env var).
   * Cached per agent+provider using the same TTL as tool-set credentials.
   */
  async getAiProviderApiKey(
    agentId: string,
    providerType: string
  ): Promise<string | null> {
    const cacheKey = `ai:${agentId}:${providerType}`;
    const cached = credentialCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as string | null;
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
        `[credential] getAiProviderApiKey(${providerType}) failed:`,
        err?.message ?? err
      );
    }

    credentialCache.set(cacheKey, {
      value: apiKey,
      expiresAt: Date.now() + CREDENTIAL_CACHE_TTL_MS,
    });
    return apiKey;
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

  async recordAutomationRun(automationId: string) {
    return this.client.mutation(api.automations.recordRun, {
      serverToken: this.serverToken,
      automationId: automationId as any,
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

  // ── Run Prompt (creates conversation + job) ─────────────────────────

  async runPrompt(agentId: string, prompt: string, title?: string) {
    return this.client.mutation(api.agentApi.runPrompt, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      prompt,
      title,
    });
  }

  // ── Assets ─────────────────────────────────────────────────────────

  async createAsset(agentId: string, data: {
    name: string;
    type: "image" | "file";
    folderId?: string;
    storageId?: string;
    url?: string;
    mimeType?: string;
    fileSize?: number;
    generatedBy?: "gemini" | "nano_banana";
    prompt?: string;
    model?: string;
    width?: number;
    height?: number;
  }) {
    return this.client.mutation(api.assets.serverCreate, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      ...data as any,
    });
  }

  async listAssets(agentId: string) {
    return this.client.query(api.assets.serverList, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }

  async getAssetUploadUrl() {
    return this.client.mutation(api.assets.serverGetUploadUrl, {
      serverToken: this.serverToken,
    });
  }

  async listOlderMessages(conversationId: string, beforeTimestamp: number, limit?: number) {
    return this.client.query(api.agentApi.listOlderMessages, {
      serverToken: this.serverToken,
      conversationId: conversationId as any,
      beforeTimestamp,
      limit,
    });
  }

  async getMessageStatus(messageId: string): Promise<{ status: string; content: string; error?: string } | null> {
    return this.client.query(api.agentApi.getMessageStatus, {
      serverToken: this.serverToken,
      messageId: messageId as any,
    });
  }

  // ── Discord Gateway ────────────────────────────────────────────────

  async listDiscordEnabledAgents() {
    return this.client.query(api.agentApi.listDiscordEnabledAgents, {
      serverToken: this.serverToken,
    });
  }

  async getOrCreateDiscordConversation(
    agentId: string,
    discordChannelId: string,
    discordGuildId: string,
    mode: "agent" | "bot",
    mentionerUsername?: string,
    mentionerUserId?: string
  ) {
    return this.client.mutation(api.agentApi.getOrCreateDiscordConversation, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      discordChannelId,
      discordGuildId,
      mode,
      mentionerUsername,
      mentionerUserId,
    });
  }

  async createDiscordJob(agentId: string, conversationId: string, userContent: string) {
    return this.client.mutation(api.agentApi.createDiscordJob, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      conversationId: conversationId as any,
      userContent,
    });
  }

  async getDiscordSourceForConversation(conversationId: string) {
    return this.client.query(api.agentApi.getDiscordSourceForConversation, {
      serverToken: this.serverToken,
      conversationId: conversationId as any,
    });
  }

  async updateDiscordGatewayState(
    agentId: string,
    state: {
      status: "connected" | "disconnected" | "connecting";
      botUserId?: string;
      sessionId?: string;
      resumeGatewayUrl?: string;
      lastSequence?: number;
    }
  ) {
    return this.client.mutation(api.agentApi.updateDiscordGatewayState, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      ...state,
    });
  }

  // ── Slack Gateway ──────────────────────────────────────────────────

  async listSlackEnabledAgents() {
    return this.client.query(api.agentApi.listSlackEnabledAgents, {
      serverToken: this.serverToken,
    });
  }

  async getOrCreateSlackConversation(
    agentId: string,
    slackTeamId: string,
    slackChannelId: string,
    channelType: "channel" | "im",
    mode: "agent" | "bot",
    mentionerUserId?: string,
    opts?: {
      slackThreadTs?: string;
      mentionerUserName?: string;
      slackChannelName?: string;
    }
  ) {
    return this.client.mutation(api.agentApi.getOrCreateSlackConversation, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      slackTeamId,
      slackChannelId,
      slackChannelName: opts?.slackChannelName,
      slackThreadTs: opts?.slackThreadTs,
      channelType,
      mode,
      mentionerUserId,
      mentionerUserName: opts?.mentionerUserName,
    });
  }

  async createSlackJob(
    agentId: string,
    conversationId: string,
    userContent: string,
    senderName?: string
  ) {
    return this.client.mutation(api.agentApi.createSlackJob, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      conversationId: conversationId as any,
      userContent,
      senderName,
    });
  }

  async getSlackSourceForConversation(conversationId: string) {
    return this.client.query(api.agentApi.getSlackSourceForConversation, {
      serverToken: this.serverToken,
      conversationId: conversationId as any,
    });
  }

  async updateSlackGatewayState(
    agentId: string,
    state: {
      status: "connected" | "disconnected" | "connecting";
      botUserId?: string;
    }
  ) {
    return this.client.mutation(api.agentApi.updateSlackGatewayState, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      ...state,
    });
  }

  async addSlackAuthorizedUser(agentId: string, slackUserId: string) {
    return this.client.mutation(api.agentApi.addSlackAuthorizedUser, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      slackUserId,
    });
  }

  async removeSlackAuthorizedUser(agentId: string, slackUserId: string) {
    return this.client.mutation(api.agentApi.removeSlackAuthorizedUser, {
      serverToken: this.serverToken,
      agentId: agentId as any,
      slackUserId,
    });
  }

  async listSlackAuthorizedUsers(agentId: string): Promise<string[]> {
    return this.client.query(api.agentApi.listSlackAuthorizedUsers, {
      serverToken: this.serverToken,
      agentId: agentId as any,
    });
  }
}
