import type { CoreMessage } from "ai";
import { existsSync, mkdirSync } from "fs";
import { AgentConvexClient } from "./convex-client.js";
import { buildMcpServer } from "./mcp-server.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { getCredentialToolSetKeys } from "@agent-maker/shared/src/tool-set-registry";
import { embedText } from "./embeddings.js";
import { runWithAiSdk } from "./run-with-ai-sdk.js";
import {
  providerTypeForModel,
  assertProviderCredentialAvailable,
} from "./model-factory.js";

export interface RunAgentParams {
  agentId: string;
  conversationId: string;
  assistantMessageId: string;
  convexUrl: string;
  serverToken: string;
}

type ToolCallEntry = {
  id: string;
  name: string;
  input: string;
  output?: string;
  progress?: string;
};

export type ToolProgressCallback = (toolName: string, progress: string) => void;

/**
 * Manages debounced/immediate Convex mutations so the client
 * sees incremental updates as the agent stream yields events.
 */
class StreamFlusher {
  private text = "";
  private toolCalls: ToolCallEntry[] = [];
  private toolCallMap = new Map<string, number>(); // id → index for O(1) lookup
  private pending: Promise<void> = Promise.resolve();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _stopped = false;
  private inflightMutation: Promise<void> | null = null;
  private pendingFlush: { status: string } | null = null;

  constructor(
    private convexClient: AgentConvexClient,
    private messageId: string
  ) {}

  get stopped() {
    return this._stopped;
  }

  setText(text: string) {
    this.text = text;
    this.scheduleDebouncedFlush();
  }

  appendText(delta: string) {
    this.text += delta;
    this.scheduleDebouncedFlush();
  }

  upsertToolCall(tc: ToolCallEntry) {
    const existingIdx = this.toolCallMap.get(tc.id);
    if (existingIdx !== undefined) {
      this.toolCalls[existingIdx] = tc;
    } else {
      this.toolCallMap.set(tc.id, this.toolCalls.length);
      this.toolCalls.push(tc);
    }
    this.flushNow("processing");
  }

  /** Update the progress text of a running tool call (matched by name, last match) */
  updateToolProgress(toolName: string, progress: string) {
    for (let i = this.toolCalls.length - 1; i >= 0; i--) {
      const tc = this.toolCalls[i];
      if ((tc.name === toolName) && !tc.output) {
        this.toolCalls[i] = { ...tc, progress };
        this.flushNow("processing");
        return;
      }
    }
  }

  async flushFinal(status: "done" | "error") {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingFlush = null;
    this.fireMutation(status);
    await this.pending;
  }

  get currentText() {
    return this.text;
  }

  get currentToolCalls() {
    return this.toolCalls;
  }

  private get debounceMs(): number {
    return this.text.length < 500 ? 25 : 50;
  }

  private scheduleDebouncedFlush() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flushNow("processing");
    }, this.debounceMs);
  }

  private flushNow(status: string) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.inflightMutation) {
      this.pendingFlush = { status };
      return;
    }
    this.fireMutation(status);
  }

  private fireMutation(status: string) {
    if (this._stopped) return;
    const text = this.text;
    const toolCalls =
      this.toolCalls.length > 0 ? [...this.toolCalls] : undefined;

    const mutationPromise = this.convexClient
      .updateMessage(this.messageId, text, status, toolCalls)
      .then((result) => {
        if (result?.stopped) {
          console.log("[agent] Message was stopped by user, aborting.");
          this._stopped = true;
        }
      })
      .catch((err) => console.error("StreamFlusher mutation error:", err))
      .finally(() => {
        this.inflightMutation = null;
        if (this.pendingFlush && !this._stopped) {
          const { status: pendingStatus } = this.pendingFlush;
          this.pendingFlush = null;
          this.fireMutation(pendingStatus);
        }
      });

    this.inflightMutation = mutationPromise;
    this.pending = this.pending.then(() => mutationPromise);
  }
}

export async function runAgent(params: RunAgentParams) {
  const convexClient = new AgentConvexClient(
    params.convexUrl,
    params.serverToken
  );

  const flusher = new StreamFlusher(convexClient, params.assistantMessageId);

  try {
    await convexClient.updateMessage(params.assistantMessageId, "", "processing");

    const agent = await convexClient.getAgent(params.agentId);
    if (!agent) throw new Error("Agent not found");

    const enabled = agent.enabledToolSets ?? [];

    const toolSetsNeedingCreds = getCredentialToolSetKeys();
    const enabledCredToolSets = toolSetsNeedingCreds.filter((ts) =>
      enabled.includes(ts)
    );

    const [
      allMessages,
      tabs,
      customTools,
      memories,
      documents,
      schedules,
      automations,
      ...credResults
    ] = await Promise.all([
      convexClient.listMessages(params.conversationId),
      convexClient.listTabs(params.agentId).then((r) => r ?? []),
      convexClient.listCustomTools(params.agentId).then((r) => r ?? []),
      convexClient.listMemories(params.agentId),
      enabled.includes("rag")
        ? convexClient.listAgentDocuments(params.agentId)
        : Promise.resolve([]),
      enabled.includes("schedules")
        ? convexClient.listSchedules(params.agentId)
        : Promise.resolve([]),
      enabled.includes("automations")
        ? convexClient.listAutomations(params.agentId)
        : Promise.resolve([]),
      ...enabledCredToolSets.map((ts) =>
        convexClient.getCredentialForToolSet(params.agentId, ts)
      ),
    ]);

    const configs: Record<string, any> = {};
    enabledCredToolSets.forEach((ts, i) => {
      configs[ts] = credResults[i];
    });

    const emailConfig = configs.email ?? null;
    const notionConfig = configs.notion ?? null;
    const slackConfig = configs.slack ?? null;
    const discordConfig = configs.discord ?? null;
    const gcalConfig = configs.google_calendar ?? null;
    const gdriveConfig = configs.google_drive ?? null;
    const gsheetsConfig = configs.google_sheets ?? null;
    const gmailConfig = configs.gmail ?? null;
    const imageGenConfig = configs.image_generation ?? null;

    // Fetch the user's stored Google AI key once up front — it's used both for
    // system-prompt memory embedding and for tool runtime (memory/RAG).
    const googleApiKey = await convexClient.getAiProviderApiKey(
      params.agentId,
      "google_ai"
    );

    const [discordSource, slackSource] = await Promise.all([
      convexClient.getDiscordSourceForConversation(params.conversationId),
      convexClient.getSlackSourceForConversation(params.conversationId),
    ]);
    const isDiscordBot = discordSource?.mode === "bot";
    const isDiscordAgent = discordSource?.mode === "agent";
    const isDiscord = isDiscordBot || isDiscordAgent;
    const isSlackBot = slackSource?.mode === "bot";
    const isSlackAgent = slackSource?.mode === "agent";
    const isSlack = isSlackBot || isSlackAgent;
    const isExternalChat = isDiscord || isSlack;

    const slackRequesterBlock = (() => {
      if (!isSlack) return "";
      const name = (slackSource as any)?.lastMentionerUserName as string | undefined;
      const uid = (slackSource as any)?.lastMentionerUserId as string | undefined;
      if (!name && !uid) return "";
      const display = name ?? uid;
      return `

## Requester
The current message is from Slack user **${display}**${name && uid ? ` (<@${uid}>)` : ""}.
Address them by name when it feels natural — especially in greetings, confirmations, or when multiple people may be in the channel. Don't force it into every sentence.`;
    })();

    let effectiveMessages = allMessages;
    let olderMessageCount = 0;
    if (isExternalChat) {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recent = allMessages.filter(
        (m: any) => m._creationTime >= twentyFourHoursAgo
      );
      olderMessageCount = allMessages.length - recent.length;
      effectiveMessages = recent;
    }

    const apiMessages = effectiveMessages
      .filter(
        (m: any) =>
          m._id !== params.assistantMessageId && m.content?.trim()
      )
      .map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const latestUserMsg = [...effectiveMessages]
      .filter((m: any) => m._id !== params.assistantMessageId)
      .reverse()
      .find((m: any) => m.role === "user");
    let prompt = latestUserMsg?.content ?? "";

    // Resolve attachments for the latest user message (multimodal support)
    if (latestUserMsg?.attachments && latestUserMsg.attachments.length > 0) {
      const attachmentParts: string[] = [];
      for (const att of latestUserMsg.attachments as Array<{
        storageId: string;
        fileName: string;
        contentType: string;
        fileSize: number;
      }>) {
        const url = await convexClient.getAttachmentUrl(att.storageId);
        if (!url) continue;

        if (att.contentType.startsWith("image/")) {
          attachmentParts.push(
            `[Attached image: ${att.fileName}]\nImage URL: ${url}`
          );
        } else if (att.contentType === "application/pdf") {
          attachmentParts.push(
            `[Attached PDF: ${att.fileName} (${(att.fileSize / 1024).toFixed(1)}KB)]\nPDF URL: ${url}`
          );
        } else if (
          att.contentType.startsWith("text/") ||
          att.contentType === "application/json"
        ) {
          try {
            const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
            const text = await resp.text();
            attachmentParts.push(
              `[Attached file: ${att.fileName}]\n\`\`\`\n${text.slice(0, 50000)}\n\`\`\``
            );
          } catch {
            attachmentParts.push(
              `[Attached file: ${att.fileName}]\nFile URL: ${url}`
            );
          }
        } else {
          attachmentParts.push(
            `[Attached file: ${att.fileName} (${att.contentType})]\nFile URL: ${url}`
          );
        }
      }
      if (attachmentParts.length > 0) {
        prompt = `${prompt}\n\n---\n**User Attachments:**\n${attachmentParts.join("\n\n")}`;
      }
    }

    const MAX_HISTORY_MESSAGES = 30;
    const allHistoryMessages = apiMessages.slice(0, -1);
    let historyMessages = allHistoryMessages;
    let truncatedMessageCount = 0;
    if (allHistoryMessages.length > MAX_HISTORY_MESSAGES) {
      truncatedMessageCount = allHistoryMessages.length - MAX_HISTORY_MESSAGES;
      historyMessages = allHistoryMessages.slice(-MAX_HISTORY_MESSAGES);
    }
    const truncationNote =
      truncatedMessageCount > 0
        ? `> [${truncatedMessageCount} earlier messages in this conversation are not shown]\n\n`
        : "";
    const conversationHistory =
      historyMessages.length > 0
        ? `\n\n## Conversation History\n${truncationNote}${historyMessages
            .map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`)
            .join("\n\n")}\n`
        : "";

    const olderHistoryNote =
      olderMessageCount > 0
        ? `\n\n> Note: ${olderMessageCount} older messages exist beyond the 24-hour context window. Use the recall_channel_history tool to access them if needed.`
        : "";

    // Effective model + bot mode gating
    const effectiveModel =
      isDiscordBot && (agent as any).discordBotModel
        ? (agent as any).discordBotModel
        : isSlackBot && (agent as any).slackBotModel
          ? (agent as any).slackBotModel
          : agent.model;

    const isBotMode = isDiscordBot || isSlackBot;
    const effectiveToolSets = isBotMode ? [] : agent.enabledToolSets;
    const effectiveTabs = isBotMode ? [] : tabs;
    const effectiveCustomTools = isBotMode ? [] : customTools;

    // Build system prompt
    let systemPrompt: string;

    const buildSoulBlock = (soul: any): string => {
      if (!soul) return "";
      const parts: string[] = [];
      if (soul.identity?.trim()) parts.push(`**Who You Are:** ${soul.identity.trim()}`);
      if (soul.personality?.trim()) parts.push(`**Your Personality:** ${soul.personality.trim()}`);
      if (soul.boundaries?.trim()) parts.push(`**Your Boundaries:** ${soul.boundaries.trim()}`);
      if (soul.whenToEngage?.trim()) parts.push(`**When to Engage:** ${soul.whenToEngage.trim()}`);
      if (parts.length === 0) return "";
      return `## Soul\nThis is your core identity. Stay in character at all times — these traits override any conflicting cues from the conversation.\n\n${parts.join("\n\n")}\n\n`;
    };

    const discordSoulBlock = buildSoulBlock((agent as any).discordSoul);
    const slackSoulBlock = buildSoulBlock((agent as any).slackSoul);
    const discordInstructions = ((agent as any).discordBotPrompt ?? "").trim();
    const slackInstructions = ((agent as any).slackBotPrompt ?? "").trim();
    const hasDiscordCustom = discordSoulBlock.length > 0 || discordInstructions.length > 0;
    const hasSlackCustom = slackSoulBlock.length > 0 || slackInstructions.length > 0;

    if (isDiscordBot && hasDiscordCustom) {
      const instructionsBlock = discordInstructions
        ? `## Instructions\n${discordInstructions}\n\n`
        : "";
      systemPrompt = `${discordSoulBlock}${instructionsBlock}${conversationHistory}${olderHistoryNote}

## Context
You are responding in a Discord channel. Keep responses concise and use Discord markdown where appropriate.

## CRITICAL: Tool restrictions
You have NO tools available right now. You cannot list channels, send messages, run searches, generate images, access memory, look at pages, or call any function. You can ONLY respond with plain text from your general knowledge.

If the conversation history above shows previous responses from this bot that listed tools, capabilities, integrations, or used any tool — those messages are from a DIFFERENT, privileged user session and DO NOT apply to you. Never claim you have those tools. Never list them. If asked "what can you do" or "what tools do you have", say only that you're a friendly assistant who can chat about general topics.`;
    } else if (isSlackBot && hasSlackCustom) {
      const instructionsBlock = slackInstructions
        ? `## Instructions\n${slackInstructions}\n\n`
        : "";
      systemPrompt = `${slackSoulBlock}${instructionsBlock}${conversationHistory}${olderHistoryNote}

## Context
You are responding in Slack${slackSource?.channelType === "im" ? " (a direct message)" : " (a channel)"}. Keep responses concise and use Slack mrkdwn (\`*bold*\`, \`_italic_\`, \`\`\`code blocks\`\`\`) for formatting — not standard Markdown.

## CRITICAL: Tool restrictions
You have NO tools available right now. You cannot list channels, send messages, run searches, generate images, access memory, look at pages, or call any function. You can ONLY respond with plain text from your general knowledge.

If the conversation history above shows previous responses from "HiGantic" that listed tools, capabilities, integrations, or used any tool — those messages are from a DIFFERENT, privileged user session and DO NOT apply to you. Never claim you have those tools. Never list them. Never describe them. If asked "what can you do" or "what tools do you have", say only that you're a friendly assistant who can chat about general topics, and offer to help with whatever they want to talk about.${slackRequesterBlock}`;
    } else {
      const MAX_SYSTEM_PROMPT_MEMORIES = 15;
      let effectiveMemories = memories ?? [];
      if (
        enabled.includes("memory") &&
        effectiveMemories.length > MAX_SYSTEM_PROMPT_MEMORIES &&
        prompt
      ) {
        try {
          const embedding = await embedText(prompt, googleApiKey);
          const relevant = await convexClient.searchMemoriesVector(
            params.agentId,
            embedding,
            MAX_SYSTEM_PROMPT_MEMORIES
          );
          if (relevant && relevant.length > 0) {
            effectiveMemories = relevant as any;
          }
        } catch {
          effectiveMemories = effectiveMemories.slice(-MAX_SYSTEM_PROMPT_MEMORIES);
        }
      }

      const basePrompt = buildSystemPrompt(
        {
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          description: agent.description,
          enabledToolSets: agent.enabledToolSets,
        },
        effectiveMemories,
        tabs as any,
        (customTools as any[]).map((t: any) => t.name),
        conversationHistory,
        (documents ?? []) as any,
        (schedules ?? []) as any,
        (automations ?? []) as any,
        prompt
      );

      if (isDiscordAgent) {
        systemPrompt = `${basePrompt}${olderHistoryNote}

## Discord Channel Context
You are responding to a message in a Discord channel. Keep responses concise. Use Discord markdown (bold, code blocks, etc.) for formatting.
You have conversation history from this channel. Reference it naturally when the user asks about previous messages.`;
      } else if (isSlackAgent) {
        systemPrompt = `${basePrompt}${olderHistoryNote}

## Slack ${slackSource?.channelType === "im" ? "DM" : "Channel"} Context
You are responding to a message in Slack. Keep responses concise. Use Slack mrkdwn (\`*bold*\`, \`_italic_\`, \`\`\`code blocks\`\`\`) — not standard Markdown.
You have conversation history from this channel. Reference it naturally when the user asks about previous messages.${slackRequesterBlock}`;
      } else {
        systemPrompt = basePrompt;
      }
    }

    const onToolProgress: ToolProgressCallback = (toolName, progress) => {
      flusher.updateToolProgress(toolName, progress);
    };

    const { tools } = buildMcpServer({
      convexClient,
      agentId: params.agentId,
      messageId: params.assistantMessageId,
      conversationId: params.conversationId,
      enabledToolSets: effectiveToolSets,
      tabs: effectiveTabs as any,
      customTools: effectiveCustomTools as any,
      emailConfig: isBotMode ? null : (emailConfig as any),
      notionConfig: isBotMode ? null : (notionConfig as any),
      slackConfig: isBotMode ? null : (slackConfig as any),
      discordConfig: isBotMode ? null : (discordConfig as any),
      gcalConfig: isBotMode ? null : (gcalConfig as any),
      gdriveConfig: isBotMode ? null : (gdriveConfig as any),
      gsheetsConfig: isBotMode ? null : (gsheetsConfig as any),
      gmailConfig: isBotMode ? null : (gmailConfig as any),
      imageGenConfig: isBotMode ? null : (imageGenConfig as any),
      imageGenModel: isBotMode ? undefined : agent.imageGenModel,
      googleApiKey,
      onToolProgress,
      isDiscordConversation: isExternalChat,
    });

    // Ensure workspace directory exists
    const agentCwd = `/tmp/agent-workspace-${params.agentId}`;
    if (!existsSync(agentCwd)) {
      mkdirSync(agentCwd, { recursive: true });
    }

    console.log(
      `[agent] Starting run for agent="${agent.name}" model="${effectiveModel || "gemini-3-flash-preview"}" conversation=${params.conversationId}`
    );

    // Resolve the BYOK API key for the selected model's provider. Falls back to
    // the agent server's env var when the user has no credential stored.
    const modelIdForRun = effectiveModel || "gemini-3-flash-preview";
    const providerType = providerTypeForModel(modelIdForRun);
    const byokApiKey = providerType
      ? await convexClient.getAiProviderApiKey(params.agentId, providerType)
      : null;
    assertProviderCredentialAvailable(modelIdForRun, byokApiKey);

    // Build the messages array: just the latest user prompt
    // (conversation history is already embedded in the system prompt)
    const messages: CoreMessage[] = [{ role: "user", content: prompt }];

    await runWithAiSdk({
      flusher,
      modelId: modelIdForRun,
      system: systemPrompt,
      messages,
      tools,
      apiKey: byokApiKey,
    });

    if (!flusher.stopped) {
      await flusher.flushFinal("done");
    }

    // Auto-generate conversation title on first exchange
    if (!flusher.stopped && allMessages.length <= 2) {
      const userMsg = allMessages.find((m: any) => m.role === "user");
      if (userMsg) {
        const titleContent = (userMsg as any).content.substring(0, 60);
        const title =
          titleContent.length < (userMsg as any).content.length
            ? titleContent + "..."
            : titleContent;
        await convexClient.updateConversationTitle(
          params.conversationId,
          title
        );
      }
    }

    console.log(
      `[agent] Run complete for agent="${agent.name}" conversation=${params.conversationId}`
    );
  } catch (error: any) {
    console.error("[agent] Error:", error.message);
    flusher.setText(
      `I encountered an error: ${error.message}. Please try again.`
    );
    await flusher.flushFinal("error");
  }
}
