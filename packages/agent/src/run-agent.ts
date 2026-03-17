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
};

/**
 * Manages debounced/immediate Convex mutations so the client
 * sees incremental updates as the agent stream yields events.
 */
class StreamFlusher {
  private text = "";
  private toolCalls: ToolCallEntry[] = [];
  private pending: Promise<void> = Promise.resolve();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _stopped = false;

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
    const idx = this.toolCalls.findIndex((t) => t.id === tc.id);
    if (idx >= 0) {
      this.toolCalls[idx] = tc;
    } else {
      this.toolCalls.push(tc);
    }
    this.flushNow("processing");
  }

  async flushFinal(status: "done" | "error") {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.enqueueMutation(status);
    await this.pending;
  }

  get currentText() {
    return this.text;
  }

  get currentToolCalls() {
    return this.toolCalls;
  }

  private get debounceMs(): number {
    return this.text.length < 500 ? 50 : 100;
  }

  private scheduleDebouncedFlush() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.enqueueMutation("processing");
    }, this.debounceMs);
  }

  private flushNow(status: string) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.enqueueMutation(status);
  }

  private enqueueMutation(status: string) {
    if (this._stopped) return;
    const text = this.text;
    const toolCalls =
      this.toolCalls.length > 0 ? [...this.toolCalls] : undefined;

    this.pending = this.pending.then(() =>
      this.convexClient
        .updateMessage(this.messageId, text, status, toolCalls)
        .then((result) => {
          if (result?.stopped) {
            console.log("[agent] Message was stopped by user, aborting.");
            this._stopped = true;
          }
        })
        .catch((err) => console.error("StreamFlusher mutation error:", err))
    );
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

    // Load conversation history
    const allMessages = await convexClient.listMessages(params.conversationId);

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
    const latestUserMsg = [...apiMessages]
      .reverse()
      .find((m) => m.role === "user");
    const prompt = latestUserMsg?.content ?? "";

    // Build conversation history (everything except the latest user message)
    const historyMessages = apiMessages.slice(0, -1);
    const conversationHistory =
      historyMessages.length > 0
        ? `\n\n## Conversation History\n${historyMessages.map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`).join("\n\n")}\n`
        : "";

    // Load tabs, custom tools, memories, and documents
    const tabs = (await convexClient.listTabs(params.agentId)) ?? [];
    const customTools = (await convexClient.listCustomTools(params.agentId)) ?? [];
    const memories = await convexClient.listMemories(params.agentId);

    const enabled = agent.enabledToolSets ?? [];
    const documents = enabled.includes("rag")
      ? await convexClient.listAgentDocuments(params.agentId)
      : [];

    // Load email config if email tool is enabled
    const emailConfig = enabled.includes("email")
      ? await convexClient.getToolConfig(params.agentId, "email")
      : null;

    // Load schedules context if schedules tool is enabled
    const schedules = enabled.includes("schedules")
      ? await convexClient.listSchedules(params.agentId)
      : [];

    // Load automations context if automations tool is enabled
    const automations = enabled.includes("automations")
      ? await convexClient.listAutomations(params.agentId)
      : [];

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
              responseText += "\n\n";
              flusher.appendText("\n\n");
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
