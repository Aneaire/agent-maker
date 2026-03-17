import { GoogleGenerativeAI } from "@google/generative-ai";
import { existsSync, mkdirSync } from "fs";
import { AgentConvexClient } from "./convex-client.js";
import { buildGeminiTools } from "./gemini-tools.js";
import { buildSystemPrompt } from "./system-prompt.js";

export interface RunGeminiAgentParams {
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
            console.log("[gemini] Message was stopped by user, aborting.");
            this._stopped = true;
          }
        })
        .catch((err) => console.error("Gemini StreamFlusher error:", err))
    );
  }
}

export async function runGeminiAgent(params: RunGeminiAgentParams) {
  const convexClient = new AgentConvexClient(
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

    // Load agent config
    const agent = await convexClient.getAgent(params.agentId);
    if (!agent) throw new Error("Agent not found");

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

    const latestUserMsg = [...apiMessages]
      .reverse()
      .find((m) => m.role === "user");
    const prompt = latestUserMsg?.content ?? "";

    const historyMessages = apiMessages.slice(0, -1);
    const conversationHistory =
      historyMessages.length > 0
        ? `\n\n## Conversation History\n${historyMessages.map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`).join("\n\n")}\n`
        : "";

    // Load context
    const tabs = (await convexClient.listTabs(params.agentId)) ?? [];
    const customTools =
      (await convexClient.listCustomTools(params.agentId)) ?? [];
    const memories = await convexClient.listMemories(params.agentId);

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
      conversationHistory
    );

    // Build Gemini tools
    const { declarations, handlers } = buildGeminiTools({
      convexClient,
      agentId: params.agentId,
      messageId: params.assistantMessageId,
      enabledToolSets: agent.enabledToolSets,
      tabs: tabs as any,
      customTools: customTools as any,
    });

    // Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = agent.model || "gemini-3-flash";

    const tools =
      declarations.length > 0
        ? [{ functionDeclarations: declarations }]
        : undefined;

    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: systemPrompt,
      tools: tools as any,
    });

    // Build chat history from prior conversation
    const geminiHistory = historyMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history: geminiHistory as any,
    });

    console.log(
      `[gemini] Starting run for agent="${agent.name}" model=${modelId} conversation=${params.conversationId}`
    );

    // Agentic loop: stream -> collect function calls -> execute -> repeat
    let currentPrompt = prompt;
    let turnCount = 0;
    const maxTurns = 20;

    while (turnCount < maxTurns && !flusher.stopped) {
      turnCount++;

      const result = await chat.sendMessageStream(currentPrompt);

      let turnText = "";
      const functionCalls: Array<{ name: string; args: Record<string, any> }> =
        [];

      for await (const chunk of result.stream) {
        if (flusher.stopped) break;

        // Collect text
        try {
          const text = chunk.text();
          if (text) {
            turnText += text;
            flusher.appendText(text);
          }
        } catch {
          // chunk.text() throws if no text content
        }

        // Collect function calls
        const calls = chunk.functionCalls();
        if (calls) {
          for (const call of calls) {
            functionCalls.push({
              name: call.name,
              args: (call.args as Record<string, any>) ?? {},
            });
          }
        }
      }

      // If no function calls, we're done
      if (functionCalls.length === 0) break;

      // Execute function calls and collect results
      const functionResponses: Array<{
        functionResponse: { name: string; response: any };
      }> = [];

      for (const call of functionCalls) {
        const handler = handlers[call.name];
        const toolCallId = `tool_${Date.now()}_${call.name}`;

        // Show tool call in UI
        flusher.upsertToolCall({
          id: toolCallId,
          name: call.name,
          input: JSON.stringify(call.args),
        });

        let output: string;
        if (handler) {
          try {
            output = await handler(call.args);
          } catch (err: any) {
            output = `Error: ${err.message}`;
          }
        } else {
          output = `Unknown tool: ${call.name}`;
        }

        // Update tool call with output
        flusher.upsertToolCall({
          id: toolCallId,
          name: call.name,
          input: JSON.stringify(call.args),
          output,
        });

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: output },
          },
        });
      }

      // Send function results back — this becomes the next message
      currentPrompt = functionResponses as any;
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
      `[gemini] Run complete for agent="${agent.name}" conversation=${params.conversationId}`
    );
  } catch (error: any) {
    console.error("[gemini] Error:", error.message);
    flusher.setText(
      `I encountered an error: ${error.message}. Please try again.`
    );
    await flusher.flushFinal("error");
  }
}

/**
 * Runs a Gemini agent synchronously for API endpoint calls.
 */
export async function runGeminiApiEndpoint(params: {
  agentId: string;
  prompt: string;
  convexUrl: string;
  serverToken: string;
  model?: string;
}): Promise<string> {
  const convexClient = new AgentConvexClient(
    params.convexUrl,
    params.serverToken
  );

  const agent = await convexClient.getAgent(params.agentId);
  if (!agent) throw new Error("Agent not found");

  const tabs = (await convexClient.listTabs(params.agentId)) ?? [];
  const customTools =
    (await convexClient.listCustomTools(params.agentId)) ?? [];
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

  // Build tools (no messageId for API — skip suggest tools)
  const { declarations, handlers } = buildGeminiTools({
    convexClient,
    agentId: params.agentId,
    messageId: "", // no message to attach suggestions to
    enabledToolSets: agent.enabledToolSets,
    tabs: tabs as any,
    customTools: customTools as any,
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelId = params.model || agent.model || "gemini-2.5-flash";

  const tools =
    declarations.length > 0
      ? [{ functionDeclarations: declarations }]
      : undefined;

  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: systemPrompt,
    tools: tools as any,
  });

  const chat = model.startChat();
  let responseText = "";
  let currentPrompt: any = params.prompt;
  let turnCount = 0;

  while (turnCount < 5) {
    turnCount++;

    const result = await chat.sendMessage(currentPrompt);
    const response = result.response;

    // Collect text
    try {
      responseText += response.text();
    } catch {}

    // Check for function calls
    const calls = response.functionCalls();
    if (!calls || calls.length === 0) break;

    const functionResponses: any[] = [];
    for (const call of calls) {
      const handler = handlers[call.name];
      let output: string;
      if (handler) {
        try {
          output = await handler((call.args as Record<string, any>) ?? {});
        } catch (err: any) {
          output = `Error: ${err.message}`;
        }
      } else {
        output = `Unknown tool: ${call.name}`;
      }
      functionResponses.push({
        functionResponse: { name: call.name, response: { result: output } },
      });
    }

    currentPrompt = functionResponses;
  }

  console.log(
    `[gemini-api] API endpoint complete for agent="${agent.name}" (${responseText.length} chars)`
  );

  return responseText;
}
