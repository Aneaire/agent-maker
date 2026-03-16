import { query } from "@anthropic-ai/claude-agent-sdk";
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync } from "fs";
import { CreatorConvexClient } from "./creator-convex-client.js";
import { createCreatorTools } from "./tools/creator-tools.js";

export interface RunCreatorParams {
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

class StreamFlusher {
  private text = "";
  private toolCalls: ToolCallEntry[] = [];
  private pending: Promise<void> = Promise.resolve();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _stopped = false;

  constructor(
    private convexClient: CreatorConvexClient,
    private messageId: string
  ) {}

  get stopped() {
    return this._stopped;
  }

  appendText(delta: string) {
    this.text += delta;
    this.scheduleDebouncedFlush();
  }

  setText(text: string) {
    this.text = text;
    this.scheduleDebouncedFlush();
  }

  upsertToolCall(tc: ToolCallEntry) {
    const idx = this.toolCalls.findIndex((t) => t.id === tc.id);
    if (idx >= 0) this.toolCalls[idx] = tc;
    else this.toolCalls.push(tc);
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

  private scheduleDebouncedFlush() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.enqueueMutation("processing");
    }, this.text.length < 500 ? 50 : 100);
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
            this._stopped = true;
          }
        })
        .catch((err) => console.error("Creator StreamFlusher error:", err))
    );
  }
}

const CREATOR_SYSTEM_PROMPT = `You are the Agent Creator — a friendly assistant that helps users build custom AI agents.

## Your Role
Guide the user through creating their perfect AI agent step by step. Be conversational and encouraging. On the very first message, give a warm welcome and offer two paths: pick a starter template OR build from scratch.

## Quick Start Templates
If the user wants to get started fast, use the \`use_template\` tool. Available templates:
- **customer_support** — Customer support agent with tickets and knowledge base
- **research_assistant** — Research agent with notes and source tracking
- **project_manager** — Project management with tasks, notes, and timeline
- **writing_assistant** — Writing and editing with drafts and ideas
- **data_analyst** — Data organization with spreadsheets and reports

After applying a template, show the user what was set up and ask if they want to customize anything.

## Creation Flow (for building from scratch)
Walk through these steps naturally (adapt to the user):

1. **Name & Purpose** — Ask what they want to name their agent and what it should do
2. **Personality & Tone** — Help craft the agent's personality (formal, casual, technical, creative, etc.)
3. **System Prompt** — Based on the conversation, write a comprehensive system prompt
4. **Tool Sets** — Discuss which capabilities to enable/disable (use \`list_tool_sets\` to show options)
5. **Model Selection** — Recommend a model based on their use case:
   - \`claude-sonnet-4-6\` — Best balance of speed and capability (recommended for most)
   - \`claude-opus-4-6\` — Most capable, best for complex reasoning
   - \`claude-haiku-4-5-20251001\` — Fastest and cheapest, good for simple tasks
6. **Starter Pages** — Offer to create initial pages (task boards, notes, spreadsheets) that will be ready when they start using the agent
7. **Icon** — Let them know they can upload a custom icon from the preview panel on the right
8. **Review & Finalize** — Show them a summary and confirm

## Important Guidelines
- Call \`update_agent_config\` as soon as the user decides on each piece (don't wait until the end)
- Write thoughtful, detailed system prompts — this is the most important part
- If the user gives a vague description, ask clarifying questions
- Before finalizing, use \`preview_config\` to show the full configuration
- Only call \`finalize_agent\` after the user explicitly confirms they're happy
- Use \`create_starter_pages\` to set up initial pages based on the agent's purpose
- Keep your responses concise — don't overwhelm with options

## System Prompt Writing Tips
When crafting the system prompt, include:
- Clear identity and role definition
- Tone and communication style
- What the agent should and shouldn't do
- Any domain-specific knowledge or context
- How to handle edge cases`;

export async function runCreator(params: RunCreatorParams) {
  const convexClient = new CreatorConvexClient(
    params.convexUrl,
    params.serverToken
  );

  const flusher = new StreamFlusher(convexClient, params.assistantMessageId);

  try {
    await convexClient.updateMessage(
      params.assistantMessageId,
      "",
      "processing"
    );

    // Load conversation history
    const allMessages = await convexClient.listMessages(params.conversationId);

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

    // Build conversation history for system prompt
    const historyMessages = apiMessages.slice(0, -1);
    const conversationHistorySection =
      historyMessages.length > 0
        ? `\n\n## Conversation So Far\n${historyMessages.map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`).join("\n\n")}\n\nContinue from where you left off. The user's latest message is provided as the prompt.`
        : "";

    // Get user plan info for plan-aware tool suggestions
    const planInfo = await convexClient.getUserPlan(params.agentId);
    const userPlan = planInfo?.plan ?? "free";

    // Build MCP server with creator tools
    const tools = createCreatorTools(convexClient, params.agentId, userPlan);
    const mcpServer = createSdkMcpServer({
      name: "creator-tools",
      version: "1.0.0",
      tools,
    });

    const allowedTools = [
      "mcp__creator-tools__update_agent_config",
      "mcp__creator-tools__preview_config",
      "mcp__creator-tools__list_tool_sets",
      "mcp__creator-tools__use_template",
      "mcp__creator-tools__create_starter_pages",
      "mcp__creator-tools__finalize_agent",
    ];

    const agentCwd = `/tmp/creator-workspace`;
    if (!existsSync(agentCwd)) {
      mkdirSync(agentCwd, { recursive: true });
    }

    console.log(
      `[creator] Starting creator run for agent=${params.agentId}`
    );

    let responseText = "";
    let lastTurnHadToolUse = false;

    const agentStream = query({
      prompt,
      options: {
        systemPrompt: CREATOR_SYSTEM_PROMPT + conversationHistorySection,
        cwd: agentCwd,
        mcpServers: { "creator-tools": mcpServer },
        allowedTools,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        maxTurns: 10,
        model: "claude-sonnet-4-6",
        stderr: (data: string) => {
          console.error("[creator] CLI stderr:", data);
        },
      },
    });

    for await (const message of agentStream) {
      if (flusher.stopped) break;

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
            const cleanName = block.name.replace(
              /^mcp__creator-tools__/,
              ""
            );
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
                flusher.upsertToolCall({ ...existing, output });
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

    if (!flusher.stopped) {
      await flusher.flushFinal("done");
    }

    console.log(`[creator] Run complete for agent=${params.agentId}`);
  } catch (error: any) {
    console.error("[creator] Error:", error.message);
    flusher.setText(
      `I encountered an error: ${error.message}. Please try again.`
    );
    await flusher.flushFinal("error");
  }
}
