import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync } from "fs";
import { AgentConvexClient } from "./convex-client.js";
import { buildMcpServer, buildAllowedTools } from "./mcp-server.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { runGeminiAgent } from "./run-gemini-agent.js";

export function isGeminiModel(model: string): boolean {
  return model.startsWith("gemini-");
}

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
    // Find the last tool call matching this name that has no output yet (still running)
    for (let i = this.toolCalls.length - 1; i >= 0; i--) {
      const tc = this.toolCalls[i];
      const cleanName = tc.name.replace(/^mcp__[^_]+__/, "");
      if ((cleanName === toolName || tc.name === toolName) && !tc.output) {
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
    // Reduced debounce: 25ms for short text, 50ms for longer text
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
    // If a mutation is already in-flight, coalesce: just mark pending
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
        // If updates accumulated while this mutation was in-flight, flush them now
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
  // Route to Gemini runner if model is a Gemini model
  const convexClient = new AgentConvexClient(
    params.convexUrl,
    params.serverToken
  );

  const agent = await convexClient.getAgent(params.agentId);
  if (agent && isGeminiModel(agent.model || "")) {
    return runGeminiAgent(params);
  }

  const flusher = new StreamFlusher(convexClient, params.assistantMessageId);

  try {
    // Update status to processing
    await convexClient.updateMessage(
      params.assistantMessageId,
      "",
      "processing"
    );

    // Load agent config (already loaded above)
    if (!agent) throw new Error("Agent not found");

    // Load all data in parallel for maximum performance
    const enabled = agent.enabledToolSets ?? [];

    // Credential loading (parallel)
    const toolSetsNeedingCreds = [
      "email", "notion", "slack", "discord", "google_calendar",
      "google_drive", "google_sheets", "gmail", "image_generation",
    ];
    const enabledCredToolSets = toolSetsNeedingCreds.filter((ts) => enabled.includes(ts));

    // Fire ALL queries in parallel — no waterfalls
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

    // Map credential results back to config object
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

    // Build conversation messages (exclude the placeholder assistant message)
    const apiMessages = allMessages
      .filter(
        (m: any) =>
          m._id !== params.assistantMessageId && m.content?.trim()
      )
      .map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Extract the latest user message as the prompt
    const latestUserMsg = [...allMessages]
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
            const resp = await fetch(url, {
              signal: AbortSignal.timeout(10000),
            });
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

    // Build conversation history (everything except the latest user message)
    const historyMessages = apiMessages.slice(0, -1);
    const conversationHistory =
      historyMessages.length > 0
        ? `\n\n## Conversation History\n${historyMessages.map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`).join("\n\n")}\n`
        : "";

    // Build system prompt with full context
    const systemPrompt = buildSystemPrompt(
      {
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        description: agent.description,
        enabledToolSets: agent.enabledToolSets,
      },
      memories ?? [],
      tabs as any,
      (customTools as any[]).map((t: any) => t.name),
      conversationHistory,
      (documents ?? []) as any,
      (schedules ?? []) as any,
      (automations ?? []) as any
    );

    // Create progress callback for tools that support streaming progress
    const onToolProgress: ToolProgressCallback = (toolName, progress) => {
      flusher.updateToolProgress(toolName, progress);
    };

    // Create MCP server with dynamic tools
    const mcpServer = buildMcpServer({
      convexClient,
      agentId: params.agentId,
      messageId: params.assistantMessageId,
      conversationId: params.conversationId,
      enabledToolSets: agent.enabledToolSets,
      tabs: tabs as any,
      customTools: customTools as any,
      emailConfig: emailConfig as any,
      notionConfig: notionConfig as any,
      slackConfig: slackConfig as any,
      discordConfig: discordConfig as any,
      gcalConfig: gcalConfig as any,
      gdriveConfig: gdriveConfig as any,
      gsheetsConfig: gsheetsConfig as any,
      gmailConfig: gmailConfig as any,
      imageGenConfig: imageGenConfig as any,
      imageGenModel: agent.imageGenModel,
      onToolProgress,
    });

    const allowedTools = buildAllowedTools(
      agent.enabledToolSets,
      tabs as any,
      customTools as any
    );

    // Ensure workspace directory exists
    const agentCwd = `/tmp/agent-workspace-${params.agentId}`;
    if (!existsSync(agentCwd)) {
      mkdirSync(agentCwd, { recursive: true });
    }

    // Run the agent
    let responseText = "";
    let lastTurnHadToolUse = false;

    console.log(
      `[agent] Starting run for agent="${agent.name}" conversation=${params.conversationId}`
    );

    const agentStream = query({
      prompt,
      options: {
        systemPrompt,
        cwd: agentCwd,
        mcpServers: { "agent-tools": mcpServer },
        allowedTools,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        maxTurns: 20,
        model: agent.model || "claude-sonnet-4-6",
        stderr: (data: string) => {
          console.error("[agent] CLI stderr:", data);
        },
      },
    });

    for await (const message of agentStream) {
      if (flusher.stopped) {
        console.log("[agent] User stopped — breaking out of stream loop.");
        break;
      }

      if (message.type === "stream_event") {
        const event = (message as any).event;
        if (!event) continue;

        if (event.type === "content_block_delta" && event.delta) {
          if (event.delta.type === "text_delta" && event.delta.text) {
            if (lastTurnHadToolUse && responseText.length > 0) {
              // Only add paragraph break if previous text ends at a sentence boundary;
              // otherwise use a space to avoid splitting mid-sentence (e.g. "Let\n\nme...")
              const trimmed = responseText.trimEnd();
              const endsAtBoundary = /[.!?:;\n\r\]})>`"']$/.test(trimmed);
              const separator = endsAtBoundary ? "\n\n" : " ";
              responseText += separator;
              flusher.appendText(separator);
              lastTurnHadToolUse = false;
            }
            responseText += event.delta.text;
            flusher.appendText(event.delta.text);
          }
        }
      } else if (message.type === "assistant" && message.message?.content) {
        let fullText = "";
        for (const block of message.message.content) {
          if ("text" in block && block.text) {
            fullText += block.text;
          } else if ("name" in block && block.name) {
            const cleanName = block.name.replace(/^mcp__agent-tools__/, "");
            lastTurnHadToolUse = true;
            flusher.upsertToolCall({
              id: block.id ?? `tool_${Date.now()}`,
              name: cleanName,
              input: JSON.stringify("input" in block ? block.input : {}),
            });
          }
        }
        if (fullText && !responseText.endsWith(fullText)) {
          if (flusher.currentText.length >= fullText.length) {
            responseText = flusher.currentText;
          } else if (responseText.length >= fullText.length) {
            responseText =
              responseText.substring(0, responseText.length - fullText.length) +
              fullText;
          } else {
            responseText = fullText;
          }
          flusher.setText(responseText);
        }
      } else if (message.type === "user" && message.message?.content) {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_result" && block.tool_use_id) {
              const existing = flusher.currentToolCalls.find(
                (t) => t.id === block.tool_use_id
              );
              if (existing) {
                let output: string | undefined;
                if (typeof block.content === "string") {
                  output = block.content;
                } else if (Array.isArray(block.content)) {
                  output = block.content
                    .filter((b: any) => b.type === "text")
                    .map((b: any) => b.text)
                    .join("\n");
                }
                flusher.upsertToolCall({
                  ...existing,
                  output,
                });
              }
            }
          }
        }
      } else if (message.type === "result") {
        if (!responseText && (message as any).subtype === "success") {
          responseText = (message as any).result ?? "";
          flusher.setText(responseText);
        }
      }
    }

    // Final flush
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
    console.error("[agent] Exit code:", error.status ?? error.exitCode);
    if (error.stderr) {
      console.error("[agent] Stderr:", error.stderr.substring(0, 2000));
    }
    flusher.setText(
      `I encountered an error: ${error.message}. Please try again.`
    );
    await flusher.flushFinal("error");
  }
}
