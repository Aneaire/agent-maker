import type { CoreMessage, Tool } from "ai";
import { CreatorConvexClient } from "./creator-convex-client.js";
import { createCreatorTools } from "./tools/creator-tools.js";
import { runWithAiSdk } from "./run-with-ai-sdk.js";
import { providerTypeForModel, assertProviderCredentialAvailable } from "./model-factory.js";

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
- **api_service** — REST API agent for external integrations (Pro+ plan)

After applying a template, show the user what was set up and ask if they want to customize anything.

## Creation Flow (for building from scratch)
Walk through these steps naturally (adapt to the user):

1. **Name & Purpose** — Ask what they want to name their agent and what it should do
2. **Personality & Tone** — Help craft the agent's personality (formal, casual, technical, creative, etc.)
3. **System Prompt** — Based on the conversation, write a comprehensive system prompt
4. **Tool Sets** — Discuss which capabilities to enable/disable (use \`list_tool_sets\` to show options). Key integrations available: Slack, Discord, Gmail, Google Calendar, Google Drive, Google Sheets, Notion. Automation tools: Schedules, Automations, Timers, Webhooks. Core: Memory, Web Search, Pages, Knowledge Base (RAG), Image Generation.
5. **Model Selection** — The model is automatically set based on the user's configured AI provider credentials. Do NOT set or change the model unless the user explicitly asks to switch models. If they ask, use \`update_agent_config\` with the model they request. Available models: Claude (claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5-20251001), Gemini (gemini-2.5-flash, gemini-3-flash-preview, gemini-3.1-pro-preview), OpenAI (gpt-4o, gpt-4o-mini, o4-mini).
6. **Starter Pages** — Offer to create initial pages (task boards, notes, spreadsheets, API pages) that will be ready when they start using the agent
6b. **API Endpoints** (if applicable) — If the user wants to expose their agent as an API or integrate with external systems, create the necessary data pages FIRST (spreadsheets, tasks, notes), then create an API page, then set up endpoints using \`create_api_endpoints\`.
7. **Icon** — Let them know they can upload a custom icon from the preview panel on the right
8. **Review & Finalize** — Show them a summary and confirm

## Important Guidelines
- **ALWAYS use the \`ask_questions\` tool when presenting choices** — never write options as bullet points in text. The tool renders interactive clickable cards. Always include a flexible last option like "Something else" so the user can type a custom answer.
- Use \`suggest_replies\` at the end of each response to offer quick follow-up actions
- Call \`update_agent_config\` as soon as the user decides on each piece (don't wait until the end)
- Write thoughtful, detailed system prompts — this is the most important part
- If the user gives a vague description, ask clarifying questions
- Before finalizing, use \`preview_config\` to show the full configuration
- Only call \`finalize_agent\` after the user explicitly confirms they're happy
- Use \`create_starter_pages\` to set up initial pages based on the agent's purpose
- Use \`create_api_endpoints\` to set up REST API endpoints if the user wants their agent accessible via API (requires Pro+ plan and an API page created first)
- Keep your responses concise — don't overwhelm with options

## Building API Endpoints That Integrate With Pages
When the user wants API endpoints that read/write their agent's data (spreadsheets, tasks, notes), follow this pattern:

1. **Create the data pages first** — e.g., a "Products" spreadsheet, a "Tasks" board
2. **Create the API page** — a page of type "api"
3. **Create endpoints with prompt templates that reference pages by name** — the agent resolves page names to tab IDs at runtime

### Prompt template examples:
- **List data**: "Use list_spreadsheet_data on the 'Products' spreadsheet. If query param 'category' is provided, filter rows where Category matches. Return as JSON array."
- **Get single record**: "Use list_spreadsheet_data on the 'Inventory' spreadsheet. Find the row where 'SKU' matches the value in the request body. Return as JSON object."
- **Add data**: "Use add_spreadsheet_row on the 'Orders' spreadsheet with the data from the request body."
- **List tasks**: "Use list_tasks on the 'Project Tasks' board. Return as JSON array with fields: id, title, status, priority."
- **Create task**: "Use create_task on the 'Support Tickets' board. Set title and description from the request body."
- **Get notes**: "Use list_notes on the 'Knowledge Base' page. If query param 'search' is provided, only return notes whose title contains that text."
- **Update record**: "Use list_spreadsheet_data on 'Contacts', find the row matching 'id' from the body, then use update_spreadsheet_row to update it."

The agent has full tool access at runtime — the prompt template tells it what to do, which page to use, and how to format the response. Always reference pages by their label name, not by ID.

## System Prompt Writing Tips
When crafting the system prompt, include:
- Clear identity and role definition
- Tone and communication style
- What the agent should and shouldn't do
- Any domain-specific knowledge or context
- How to handle edge cases`;

const EDITOR_SYSTEM_PROMPT = `You are the Agent Editor — a helpful assistant that helps users update and improve their existing AI agents.

## Your Role
The user already has a working agent. Help them modify its configuration: update the name, description, system prompt, model, tool sets, add new pages, or set up API endpoints. Start by using \`preview_config\` to see the current state, then ask what they'd like to change.

## What You Can Do
- Update any agent field: name, description, system prompt, model, enabled tool sets
- Add new pages: task boards, notes, spreadsheets, markdown, API pages
- Create API endpoints on existing API pages
- Enable integrations: Slack, Discord, Gmail, Google Calendar, Google Drive, Google Sheets, Notion, Resend Email
- Enable automation features: Schedules, Automations, Timers, Webhooks, Inter-Agent Messaging
- Enable core capabilities: Memory, Web Search, Pages, Knowledge Base (RAG), Image Generation, Custom HTTP Tools
- Recommend improvements based on the current config

## Integration Setup Guidance
When the user enables an integration, remind them that credentials must be configured in the agent's **Settings → Integrations** tab before the integration will work:
- **Slack** — requires a Slack bot token (OAuth); the bot must be installed to their workspace
- **Discord** — requires a Discord bot token; the bot must be added to their server
- **Gmail / Google Calendar / Google Drive / Google Sheets** — requires Google OAuth (authenticate via Settings)
- **Notion** — requires a Notion integration token linked to their workspace
- **Resend Email** — requires a Resend API key and a verified "from" email address
- **Knowledge Base (RAG)** — no external credentials needed; user uploads documents in the agent's RAG page

## Guidelines
- Start by previewing the current config and summarizing it
- Ask what they want to change — don't assume
- **ALWAYS use the \`ask_questions\` tool when presenting choices** — never write options as bullet points in text. The tool renders interactive clickable cards. Always include a flexible last option like "Something else" so the user can type a custom answer.
- Use \`suggest_replies\` at the end of each response to offer quick follow-up actions
- Call \`update_agent_config\` immediately when the user decides on a change
- For system prompt edits, show the proposed changes before applying
- Use \`preview_config\` to show the updated state after changes
- When done, call \`finalize_agent\` to save and complete the editing session
- Keep responses concise — the user knows their agent

## Building API Endpoints That Integrate With Pages
When the user wants API endpoints that read/write their agent's data (spreadsheets, tasks, notes), follow this pattern:

1. **Create the data pages first** if they don't exist
2. **Create the API page** if one doesn't exist
3. **Create endpoints with prompt templates that reference pages by name**

### Prompt template examples:
- **List data**: "Use list_spreadsheet_data on the 'Products' spreadsheet. Return as JSON array."
- **Get single record**: "Use list_spreadsheet_data on the 'Inventory' spreadsheet. Find the row where 'SKU' matches the value in the request body."
- **Add data**: "Use add_spreadsheet_row on the 'Orders' spreadsheet with the data from the request body."
- **List tasks**: "Use list_tasks on the 'Project Tasks' board. Return as JSON array."
- **Create task**: "Use create_task on the 'Support Tickets' board. Set title and description from the request body."

The agent has full tool access at runtime — the prompt template tells it what to do and which page to use.`;

export async function runCreator(params: RunCreatorParams) {
  const convexClient = new CreatorConvexClient(
    params.convexUrl,
    params.serverToken
  );

  const flusher = new StreamFlusher(convexClient, params.assistantMessageId);

  try {
    await convexClient.updateMessage(params.assistantMessageId, "", "processing");

    const allMessages = await convexClient.listMessages(params.conversationId);

    const apiMessages = allMessages
      .filter(
        (m: any) => m._id !== params.assistantMessageId && m.content?.trim()
      )
      .map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const latestUserMsg = [...apiMessages].reverse().find((m) => m.role === "user");
    const prompt = latestUserMsg?.content ?? "";

    const historyMessages = apiMessages.slice(0, -1);
    const conversationHistorySection =
      historyMessages.length > 0
        ? `\n\n## Conversation So Far\n${historyMessages
            .map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`)
            .join("\n\n")}\n\nContinue from where you left off. The user's latest message is provided as the prompt.`
        : "";

    const planInfo = await convexClient.getUserPlan(params.agentId);
    const userPlan = planInfo?.plan ?? "free";
    const sessionInfo = await convexClient.getSessionInfo(params.conversationId);
    const sessionMode = sessionInfo.mode;

    // Build creator tools into a flat Record<string, Tool>
    const toolArray = createCreatorTools(
      convexClient,
      params.agentId,
      userPlan,
      params.assistantMessageId
    );
    const tools: Record<string, Tool<any, any>> = Object.assign({}, ...toolArray);

    const systemPrompt =
      (sessionMode === "edit" ? EDITOR_SYSTEM_PROMPT : CREATOR_SYSTEM_PROMPT) +
      conversationHistorySection;

    // Use the model the user selected for this session, defaulting to Sonnet.
    const creatorModelId = sessionInfo.creatorModel ?? "gemini-3-flash-preview";
    const providerType = providerTypeForModel(creatorModelId);
    const byokApiKey = providerType
      ? await convexClient.getAiProviderApiKey(params.agentId, providerType)
      : null;
    assertProviderCredentialAvailable(creatorModelId, byokApiKey);

    console.log(`[creator] Starting creator run for agent=${params.agentId}`);

    const messages: CoreMessage[] = [{ role: "user", content: prompt }];

    await runWithAiSdk({
      flusher,
      modelId: creatorModelId,
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 10,
      apiKey: byokApiKey,
    });

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
