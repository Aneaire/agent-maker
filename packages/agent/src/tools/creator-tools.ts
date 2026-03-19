import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { CreatorConvexClient } from "../creator-convex-client.js";

interface CreatorContext {
  convexClient: CreatorConvexClient;
  agentId: string;
  userPlan: string;
}

export function createCreatorTools(
  convexClient: CreatorConvexClient,
  agentId: string,
  userPlan: string = "free",
  messageId?: string
) {
  const ctx: CreatorContext = { convexClient, agentId, userPlan };
  const tools = [
    createUpdateConfigTool(ctx),
    createPreviewConfigTool(ctx),
    createListToolSetsTool(ctx),
    createUseTemplateTool(ctx),
    createStarterPagesTool(ctx),
    createApiEndpointsTool(ctx),
    createFinalizeTool(ctx),
  ];

  if (messageId) {
    tools.push(
      ...createCreatorSuggestTools(convexClient, messageId)
    );
  }

  return tools;
}

// ── Suggest & Question Tools ──────────────────────────────────────────

function createCreatorSuggestTools(
  convexClient: CreatorConvexClient,
  messageId: string
) {
  const suggestReplies = tool(
    "suggest_replies",
    "Suggest 2-4 follow-up options the user might want. Call at the END of your response. Keep each under 60 chars, specific and actionable.",
    {
      suggestions: z
        .array(z.string())
        .min(2)
        .max(4)
        .describe("Suggested follow-up messages"),
    },
    async (input) => {
      await convexClient.setSuggestions(messageId, input.suggestions);
      return {
        content: [
          { type: "text" as const, text: `Set ${input.suggestions.length} suggestions.` },
        ],
      };
    }
  );

  const askQuestions = tool(
    "ask_questions",
    `Present interactive multiple-choice questions to the user. Use this INSTEAD of writing options as bullet points in your text. Each question renders as a clickable card. Do NOT duplicate the questions in your text — the tool handles display. Always include a flexible last option like "Something else" or "Custom name" so the user can type their own answer.`,
    {
      questions: z
        .array(
          z.object({
            id: z.string().describe("Unique short ID, e.g. 'page_name'"),
            question: z.string().describe("The question text"),
            options: z
              .array(z.string())
              .min(2)
              .max(6)
              .describe("Selectable options, keep each under 40 chars"),
          })
        )
        .min(1)
        .max(6),
    },
    async (input) => {
      await convexClient.setQuestions(messageId, input.questions);
      return {
        content: [
          {
            type: "text" as const,
            text: `Presented ${input.questions.length} question(s). Wait for the user's selections.`,
          },
        ],
      };
    }
  );

  return [suggestReplies, askQuestions];
}

// ── Update Agent Config ───────────────────────────────────────────────

function createUpdateConfigTool(ctx: CreatorContext) {
  return tool(
    "update_agent_config",
    `Update the agent's configuration. Call this whenever the user decides on a name, description, system prompt, model, or tools. You can update one or multiple fields at once. Always call this to save progress as the conversation evolves.`,
    {
      name: z
        .string()
        .optional()
        .describe("The agent's display name"),
      description: z
        .string()
        .optional()
        .describe("A short description of what the agent does"),
      systemPrompt: z
        .string()
        .optional()
        .describe(
          "The full system prompt that defines the agent's personality, capabilities, and behavior"
        ),
      model: z
        .string()
        .optional()
        .describe(
          'The AI model to use. Claude: "claude-sonnet-4-6" (balanced), "claude-opus-4-6" (most capable), "claude-haiku-4-5-20251001" (fastest). Gemini: "gemini-3.1-pro" (most capable), "gemini-3-flash" (fast, agentic), "gemini-2.5-flash" (balanced)'
        ),
      enabledToolSets: z
        .array(z.string())
        .optional()
        .describe(
          'Tool sets to enable/disable. Available: "memory" (store/recall info), "web_search" (search & fetch web pages), "pages" (tasks, notes, spreadsheets, markdown), "custom_http_tools" (user-defined HTTP APIs). Pro+ plans also support "rest_api" and "postgres". Pass the full desired array — omitted sets will be disabled.'
        ),
    },
    async (input) => {
      await ctx.convexClient.updateAgentConfig(ctx.agentId, input);
      const fields = Object.entries(input)
        .filter(([, v]) => v !== undefined)
        .map(([k]) => k);
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated agent config: ${fields.join(", ")}`,
          },
        ],
      };
    }
  );
}

// ── Preview Config ────────────────────────────────────────────────────

function createPreviewConfigTool(ctx: CreatorContext) {
  return tool(
    "preview_config",
    "Get the current agent configuration. Use this to review what's been set so far before finalizing.",
    {},
    async () => {
      const config = await ctx.convexClient.getAgentConfig(ctx.agentId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(config, null, 2),
          },
        ],
      };
    }
  );
}

// ── List Tool Sets ────────────────────────────────────────────────────

function createListToolSetsTool(ctx: CreatorContext) {
  return tool(
    "list_tool_sets",
    "List all available tool sets and capabilities that can be enabled for the agent. Shows which are enabled by default and which require a higher plan.",
    {},
    async () => {
      const isPro = ctx.userPlan === "pro" || ctx.userPlan === "enterprise";

      const toolSets = [
        {
          name: "memory",
          description:
            "Store and recall information across conversations. Enabled by default.",
          enabledByDefault: true,
          canDisable: true,
        },
        {
          name: "web_search",
          description:
            "Search the web and fetch web pages for current information. Enabled by default.",
          enabledByDefault: true,
          canDisable: true,
        },
        {
          name: "pages",
          description:
            "Create and manage pages: Tasks (kanban boards), Notes (markdown), Spreadsheets (data tables), Markdown pages, Data Tables. The agent can autonomously create pages and manage data. Enabled by default.",
          enabledByDefault: true,
          canDisable: true,
        },
        {
          name: "custom_http_tools",
          description:
            "User-defined HTTP API tools. Users can add custom endpoints in Settings that the agent can call. Enabled by default.",
          enabledByDefault: true,
          canDisable: true,
        },
        {
          name: "email",
          description:
            "Send emails via Resend. Requires the user to configure a Resend API key and from address in Settings.",
          enabledByDefault: false,
          canDisable: true,
        },
        {
          name: "rest_api",
          description:
            "Expose the agent as a REST API. Users can create API endpoints that external systems call, with the agent processing requests.",
          requiresPlan: "pro",
          available: isPro,
        },
        {
          name: "postgres",
          description:
            "Connect to external PostgreSQL databases. The agent can run read-only queries.",
          requiresPlan: "pro",
          available: isPro,
        },
        {
          name: "schedules",
          description:
            "Create recurring or one-time scheduled actions (cron jobs, intervals). Agents can autonomously check APIs, send reports, create tasks on a schedule.",
          enabledByDefault: false,
          canDisable: true,
        },
        {
          name: "automations",
          description:
            "Create event-driven automation rules. When X happens → do Y automatically. E.g., 'when task completed → send email summary'.",
          enabledByDefault: false,
          canDisable: true,
        },
        {
          name: "timers",
          description:
            "Set delayed actions: 'follow up in 30 minutes', 'remind me tomorrow'. Useful for drip sequences and follow-ups.",
          enabledByDefault: false,
          canDisable: true,
        },
        {
          name: "webhooks",
          description:
            "Fire outgoing webhooks to external services (Slack, Discord, Zapier, n8n). View event history.",
          enabledByDefault: false,
          canDisable: true,
        },
        {
          name: "agent_messages",
          description:
            "Communicate with other agents owned by the same user. Enables multi-agent workflows, delegation, and coordination.",
          enabledByDefault: false,
          canDisable: true,
        },
        {
          name: "rag",
          description:
            "Search uploaded documents (PDF, DOCX, etc.) using vector search. Agents can find relevant information from a knowledge base.",
          enabledByDefault: false,
          canDisable: true,
        },
      ];
      return {
        content: [
          {
            type: "text" as const,
            text: `User plan: ${ctx.userPlan}\n\n${JSON.stringify(toolSets, null, 2)}`,
          },
        ],
      };
    }
  );
}

// ── Use Template ──────────────────────────────────────────────────────

const TEMPLATES: Record<
  string,
  {
    name: string;
    description: string;
    systemPrompt: string;
    model: string;
    enabledToolSets: string[];
    starterPages?: Array<{ label: string; type: string }>;
    starterEndpoints?: Array<{
      tabLabel: string;
      name: string;
      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      description?: string;
      promptTemplate: string;
      responseFormat?: "json" | "text";
    }>;
  }
> = {
  personal_assistant: {
    name: "Personal Assistant",
    description: "Daily planner and life organizer for tasks, reminders, and routines",
    systemPrompt: `You are a helpful and organized personal assistant.

## Your Role
Help the user plan their day, manage to-dos, set reminders, and stay on top of their life. Be proactive, supportive, and action-oriented.

## Tone & Style
- Friendly and encouraging — like a reliable friend who keeps you on track
- Concise — bullet points and checklists over long paragraphs
- Proactively suggest next steps and follow-ups

## Guidelines
- When the user mentions something they need to do, immediately add it to their Daily Tasks
- Use timers and schedules for reminders and recurring tasks
- Store preferences and routines in memory (wake-up time, work hours, habits)
- At the start of each conversation, review open tasks and suggest priorities
- Keep notes organized for quick reference`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "pages", "timers", "schedules"],
    starterPages: [
      { label: "Daily Tasks", type: "tasks" },
      { label: "Notes", type: "notes" },
    ],
  },
  journal_reflection: {
    name: "Journal & Reflection",
    description: "Guided journaling companion for mood check-ins, gratitude, and self-reflection",
    systemPrompt: `You are a thoughtful journaling and reflection companion.

## Your Role
Guide the user through journaling, mood check-ins, gratitude practice, and weekly reflections. Help them build self-awareness and a consistent writing habit.

## Tone & Style
- Warm, gentle, and non-judgmental
- Ask open-ended questions that invite reflection
- Mirror the user's emotional tone — don't be overly cheerful if they're struggling
- Celebrate consistency and growth

## Guidelines
- Start conversations by asking how the user is feeling today
- Offer journaling prompts when the user isn't sure what to write about
- Save journal entries as notes with dates in the title
- Use memory to track mood patterns, recurring themes, and milestones
- Suggest weekly reflection summaries based on the week's entries
- Keep prompts and templates in the Prompts & Reflections page for reuse`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "pages"],
    starterPages: [
      { label: "Journal Entries", type: "notes" },
      { label: "Prompts & Reflections", type: "markdown" },
    ],
  },
  learning_study_buddy: {
    name: "Study Buddy",
    description: "Learning companion for study notes, Q&A practice, and goal tracking",
    systemPrompt: `You are an enthusiastic and knowledgeable study buddy.

## Your Role
Help the user learn new topics, take structured notes, practice with Q&A, and track their learning goals. Make studying engaging and effective.

## Tone & Style
- Encouraging and patient — no question is too basic
- Break complex topics into digestible pieces
- Use analogies and examples to explain concepts
- Quiz the user to reinforce learning

## Guidelines
- When the user shares a topic, research it thoroughly using web search
- Organize study notes by subject with clear headings and key takeaways
- Create practice questions and flashcard-style Q&A to test understanding
- Track learning goals as tasks with progress updates
- Store the user's learning level and interests in memory
- Suggest related topics and next steps after each study session`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "web_search", "pages"],
    starterPages: [
      { label: "Study Notes", type: "notes" },
      { label: "Learning Goals", type: "tasks" },
    ],
  },
  budget_finance: {
    name: "Finance Tracker",
    description: "Budget assistant for expense logging, spending analysis, and savings goals",
    systemPrompt: `You are a practical and detail-oriented personal finance assistant.

## Your Role
Help the user track expenses, manage budgets, analyze spending patterns, and work toward savings goals. Make personal finance simple and stress-free.

## Tone & Style
- Straightforward and supportive — no judgment about spending habits
- Use numbers and data to back up suggestions
- Keep things simple — avoid financial jargon unless the user is savvy
- Celebrate progress toward goals

## Guidelines
- Log transactions in the Transactions data table with date, category, amount, and description
- Analyze spending by category when asked (sum up transactions, find trends)
- Help set and track budget limits per category
- Store budget preferences and income info in memory
- Use Budget Notes for monthly summaries, goals, and financial plans
- When the user mentions a purchase, proactively ask if they'd like to log it`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "pages"],
    starterPages: [
      { label: "Transactions", type: "data_table" },
      { label: "Budget Notes", type: "notes" },
    ],
  },
  customer_support: {
    name: "Support Agent",
    description: "Friendly customer support agent that helps users with questions and issues",
    systemPrompt: `You are a friendly and professional customer support agent.

## Your Role
Help users with their questions, troubleshoot issues, and provide clear solutions. Be empathetic, patient, and solution-oriented.

## Tone & Style
- Warm and professional — never robotic
- Acknowledge the user's frustration before jumping to solutions
- Use simple, clear language — avoid jargon
- Always confirm the issue is resolved before closing

## Guidelines
- Ask clarifying questions when the issue is unclear
- Provide step-by-step solutions when applicable
- If you can't resolve something, explain why and suggest next steps
- Track recurring issues in your task board
- Save important context about the user in memory for future conversations`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools"],
    starterPages: [
      { label: "Open Tickets", type: "tasks" },
      { label: "Knowledge Base", type: "notes" },
    ],
  },
  research_assistant: {
    name: "Research Assistant",
    description: "Thorough research assistant that finds, analyzes, and organizes information",
    systemPrompt: `You are a meticulous research assistant.

## Your Role
Help users research topics thoroughly. Find accurate information, analyze it critically, and present findings in an organized way.

## Tone & Style
- Clear and analytical
- Cite sources when using web search results
- Distinguish between facts and opinions
- Present multiple perspectives on controversial topics

## Guidelines
- Always search the web for current data rather than relying on training data
- Organize findings into notes pages with clear structure
- Use spreadsheets to compare options or track data points
- Store key findings in memory for follow-up conversations
- When the user asks about a broad topic, break it into sub-questions and research each`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools"],
    starterPages: [
      { label: "Research Notes", type: "notes" },
      { label: "Sources", type: "spreadsheet" },
    ],
  },
  project_manager: {
    name: "Project Manager",
    description: "Organized project manager that tracks tasks, deadlines, and team progress",
    systemPrompt: `You are an organized and proactive project manager.

## Your Role
Help users plan, track, and manage projects. Break down goals into actionable tasks, track progress, and keep things moving forward.

## Tone & Style
- Action-oriented and organized
- Concise — bullet points over paragraphs
- Proactively suggest next steps
- Celebrate wins and acknowledge progress

## Guidelines
- When a user describes a project, immediately break it into tasks on the task board
- Assign priorities (high/medium/low) based on dependencies and deadlines
- Use spreadsheets for tracking metrics, budgets, or timelines
- Create notes pages for meeting notes, decisions, and project documentation
- Remember project context across conversations
- Ask about blockers and suggest solutions`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools"],
    starterPages: [
      { label: "Project Tasks", type: "tasks" },
      { label: "Meeting Notes", type: "notes" },
      { label: "Timeline", type: "spreadsheet" },
    ],
  },
  writing_assistant: {
    name: "Writing Assistant",
    description: "Creative writing assistant for drafting, editing, and improving content",
    systemPrompt: `You are a skilled writing assistant.

## Your Role
Help users write, edit, and improve content — from emails and blog posts to reports and creative writing.

## Tone & Style
- Adapt your tone to match the user's desired voice
- Be constructive with feedback — explain *why* something could be better
- Suggest alternatives rather than just pointing out problems

## Guidelines
- Ask about the target audience and purpose before writing
- Use markdown pages to draft and iterate on longer pieces
- Store the user's style preferences in memory (formal vs casual, preferred length, etc.)
- When editing, explain your changes
- Offer multiple variations when the user is unsure about tone or direction
- Use notes to keep running lists of ideas, outlines, and feedback`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "pages"],
    starterPages: [
      { label: "Drafts", type: "notes" },
      { label: "Ideas", type: "notes" },
    ],
  },
  api_service: {
    name: "API Service Agent",
    description: "Agent exposed as a REST API with full page access for external integrations",
    systemPrompt: `You are an API service agent that processes incoming requests and returns structured responses.

## Your Role
Handle API requests from external systems. You have full access to your pages (spreadsheets, tasks, notes) and should use them to read, write, and query data as instructed by each endpoint.

## Tone & Style
- Precise and machine-friendly
- Always return valid, parseable responses
- Be consistent in response structure
- Include relevant data fields without unnecessary verbosity

## Guidelines
- Follow each endpoint's prompt template exactly
- When responding in JSON format, always return valid JSON with consistent field names
- Use your page tools (list_spreadsheet_data, list_tasks, list_notes, etc.) to read and write data
- Match page names from the prompt to your available pages listed in "Your Pages" above
- If input data is malformed or missing required fields, return a clear error response like: { "error": "Missing required field: name" }
- Keep responses focused on the requested data — no conversational filler
- When querying spreadsheets, use list_spreadsheet_data and filter the results in your response
- When the request asks to create/update data, use the appropriate write tools and confirm the action`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools", "rest_api"],
    starterPages: [
      { label: "API Endpoints", type: "api" },
      { label: "Data", type: "spreadsheet" },
      { label: "Logs", type: "notes" },
    ],
    starterEndpoints: [
      {
        tabLabel: "API Endpoints",
        name: "List Records",
        method: "GET",
        description: "List all rows from the Data spreadsheet, with optional filtering via query params",
        promptTemplate: `Use list_spreadsheet_data on the "Data" spreadsheet to get all rows.

If query parameters are provided, filter the results:
- If a "column" and "value" param are present, only return rows where that column matches the value.
- If a "limit" param is present, return at most that many rows.
- If a "search" param is present, return rows where any column contains that text.

Return the results as a JSON array of objects, where each object's keys are the column names.
Example: [{"Name": "Alice", "Email": "alice@example.com"}, ...]

If the spreadsheet is empty, return an empty array: []`,
        responseFormat: "json",
      },
      {
        tabLabel: "API Endpoints",
        name: "Get Record",
        method: "POST",
        description: "Query a single record from the Data spreadsheet by matching a field value",
        promptTemplate: `Use list_spreadsheet_data on the "Data" spreadsheet.

The request body will contain a query like: { "column": "Name", "value": "Alice" }

Find the first row where the specified column matches the specified value.
Return the matching row as a JSON object with column names as keys.

If no match is found, return: { "error": "No record found", "query": <the original query> }`,
        responseFormat: "json",
      },
      {
        tabLabel: "API Endpoints",
        name: "Add Record",
        method: "POST",
        description: "Add a new row to the Data spreadsheet from request body",
        promptTemplate: `Add a new row to the "Data" spreadsheet using add_spreadsheet_row.

The request body contains the row data as key-value pairs matching column names.
Example body: { "Name": "Bob", "Email": "bob@example.com", "Status": "active" }

Use add_spreadsheet_row with the provided data.
Return: { "success": true, "message": "Record added", "data": <the data that was added> }

If required columns are missing from the body, return: { "error": "Missing fields", "required": [<list the spreadsheet column names>] }`,
        responseFormat: "json",
      },
    ],
  },
  data_analyst: {
    name: "Data Analyst",
    description: "Analytical assistant that helps organize, track, and analyze data",
    systemPrompt: `You are a sharp data analyst assistant.

## Your Role
Help users collect, organize, and analyze data. Build spreadsheets, identify patterns, and present insights clearly.

## Tone & Style
- Precise and data-driven
- Explain findings in plain language
- Use tables and structured formats for clarity
- Always show your reasoning

## Guidelines
- Set up spreadsheets with properly typed columns before adding data
- When the user shares data, organize it immediately into a spreadsheet
- Use markdown pages for analysis summaries and reports
- Search the web for benchmarks, comparisons, or reference data
- Store analysis context in memory for follow-up questions
- Ask what metrics or KPIs matter most to the user`,
    model: "claude-sonnet-4-6",
    enabledToolSets: ["memory", "web_search", "pages", "custom_http_tools"],
    starterPages: [
      { label: "Data Tracker", type: "spreadsheet" },
      { label: "Analysis Reports", type: "notes" },
    ],
  },
};

function createUseTemplateTool(ctx: CreatorContext) {
  const templateList = Object.entries(TEMPLATES)
    .map(([key, t]) => `- "${key}": ${t.name} — ${t.description}`)
    .join("\n");

  return tool(
    "use_template",
    `Apply a starter template to quickly configure the agent. This sets name, description, system prompt, model, and tool sets all at once. The user can then customize any part. Available templates:\n${templateList}`,
    {
      templateId: z
        .enum(
          Object.keys(TEMPLATES) as [string, ...string[]]
        )
        .describe("The template ID to apply"),
    },
    async (input) => {
      const template = TEMPLATES[input.templateId];
      if (!template) {
        return {
          content: [
            { type: "text" as const, text: `Template "${input.templateId}" not found.` },
          ],
        };
      }

      await ctx.convexClient.updateAgentConfig(ctx.agentId, {
        name: template.name,
        description: template.description,
        systemPrompt: template.systemPrompt,
        model: template.model,
        enabledToolSets: template.enabledToolSets,
      });

      // Create starter pages
      const createdPages: string[] = [];
      if (template.starterPages) {
        for (const page of template.starterPages) {
          try {
            await ctx.convexClient.createPage(
              ctx.agentId,
              page.label,
              page.type
            );
            createdPages.push(`"${page.label}" (${page.type})`);
          } catch (err: any) {
            console.error(`[creator] Failed to create page "${page.label}":`, err.message);
          }
        }
      }

      // Create starter API endpoints
      const createdEndpoints: string[] = [];
      if (template.starterEndpoints) {
        for (const ep of template.starterEndpoints) {
          try {
            const tabId = await ctx.convexClient.findTabByLabel(
              ctx.agentId,
              ep.tabLabel
            );
            if (tabId) {
              await ctx.convexClient.createApiEndpoint(ctx.agentId, tabId, {
                name: ep.name,
                method: ep.method,
                description: ep.description,
                promptTemplate: ep.promptTemplate,
                responseFormat: ep.responseFormat,
              });
              createdEndpoints.push(`${ep.method} "${ep.name}"`);
            }
          } catch (err: any) {
            console.error(`[creator] Failed to create endpoint "${ep.name}":`, err.message);
          }
        }
      }

      const pagesNote =
        createdPages.length > 0
          ? `\n\nAlso created starter pages: ${createdPages.join(", ")}`
          : "";

      const endpointsNote =
        createdEndpoints.length > 0
          ? `\nCreated API endpoints: ${createdEndpoints.join(", ")}`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `Applied "${input.templateId}" template: ${template.name}.\nSet name, description, system prompt, model (${template.model}), and tool sets.${pagesNote}${endpointsNote}\n\nThe user can now customize any of these. Show them a summary and ask if they'd like to adjust anything.`,
          },
        ],
      };
    }
  );
}

// ── Create Starter Pages ──────────────────────────────────────────────

function createStarterPagesTool(ctx: CreatorContext) {
  return tool(
    "create_starter_pages",
    "Create initial pages for the agent during setup. Use this to set up task boards, notes, spreadsheets, etc. that will be ready when the user starts chatting with their new agent.",
    {
      pages: z
        .array(
          z.object({
            label: z
              .string()
              .describe("Display name for the page (e.g. 'Project Tasks')"),
            type: z
              .enum(["tasks", "notes", "spreadsheet", "markdown", "data_table", "api"])
              .describe("Page type"),
          })
        )
        .min(1)
        .max(5)
        .describe("Array of pages to create"),
    },
    async (input) => {
      const created: string[] = [];
      const errors: string[] = [];

      for (const page of input.pages) {
        try {
          await ctx.convexClient.createPage(
            ctx.agentId,
            page.label,
            page.type
          );
          created.push(`"${page.label}" (${page.type})`);
        } catch (err: any) {
          errors.push(`"${page.label}": ${err.message}`);
        }
      }

      let text = "";
      if (created.length > 0) {
        text += `Created ${created.length} page(s): ${created.join(", ")}`;
      }
      if (errors.length > 0) {
        text += `\nFailed: ${errors.join("; ")}`;
      }

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );
}

// ── Create API Endpoints ──────────────────────────────────────────────

function createApiEndpointsTool(ctx: CreatorContext) {
  return tool(
    "create_api_endpoints",
    `Create REST API endpoints on an existing API page. The agent must have an API page created first (via create_starter_pages with type "api"). Each endpoint defines how external systems interact with the agent. Requires Pro+ plan.

IMPORTANT: The agent already knows its pages and tab IDs from its system prompt (injected as "## Your Pages"). Prompt templates should instruct the agent to use its page tools to read/write data. You do NOT need to hardcode tab IDs — the agent resolves them at runtime.

## Available page tools the agent can use at runtime:
- list_spreadsheet_data(tabId) — get all columns and rows from a spreadsheet
- list_tasks(tabId) — list all tasks from a task board
- list_notes(tabId) — list all notes from a notes page
- add_spreadsheet_row(tabId, data) — add a row to a spreadsheet
- create_task(tabId, title, description, status, priority) — create a task
- save_note(tabId, title, content) — create a note
- update_spreadsheet_row(rowId, data) — update a specific row
- update_task(taskId, ...) — update a specific task
- update_note(noteId, ...) — update a specific note

## Prompt template tips:
- Reference pages by name: "Use the list_spreadsheet_data tool on the 'Products' spreadsheet"
- For filtering: "Find the row where Name equals the value from the request body"
- For queries: "Use list_spreadsheet_data on the 'Inventory' spreadsheet, then filter rows where 'quantity' < 10"
- The agent will match page names to tab IDs automatically from its system prompt context`,
    {
      tabLabel: z
        .string()
        .describe(
          'The label of the API page to add endpoints to (e.g. "API Endpoints")'
        ),
      endpoints: z
        .array(
          z.object({
            name: z
              .string()
              .max(100)
              .describe(
                'Display name for the endpoint (e.g. "Analyze Sentiment")'
              ),
            method: z
              .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
              .describe("HTTP method"),
            description: z
              .string()
              .max(500)
              .optional()
              .describe("Short description of what this endpoint does"),
            promptTemplate: z
              .string()
              .max(5000)
              .describe(
                'Instructions for the agent when handling this endpoint. Tell the agent which page tools to use and how to process the data. The agent already knows its pages and their IDs from the system prompt.'
              ),
            responseFormat: z
              .enum(["json", "text"])
              .default("json")
              .describe("Response format — json or text"),
          })
        )
        .min(1)
        .max(10)
        .describe("Array of endpoints to create"),
    },
    async (input) => {
      if (ctx.userPlan === "free") {
        return {
          content: [
            {
              type: "text" as const,
              text: "REST API endpoints require a Pro or Enterprise plan. The user can still create the agent and upgrade later to enable API endpoints.",
            },
          ],
        };
      }

      // Find the API tab by label
      const tabId = await ctx.convexClient.findTabByLabel(
        ctx.agentId,
        input.tabLabel
      );
      if (!tabId) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No API page found with label "${input.tabLabel}". Create one first using create_starter_pages with type "api".`,
            },
          ],
        };
      }

      const created: string[] = [];
      const errors: string[] = [];

      for (const ep of input.endpoints) {
        try {
          await ctx.convexClient.createApiEndpoint(ctx.agentId, tabId, {
            name: ep.name,
            method: ep.method,
            description: ep.description,
            promptTemplate: ep.promptTemplate,
            responseFormat: ep.responseFormat,
          });
          created.push(`${ep.method} "${ep.name}"`);
        } catch (err: any) {
          errors.push(`"${ep.name}": ${err.message}`);
        }
      }

      let text = "";
      if (created.length > 0) {
        text += `Created ${created.length} endpoint(s): ${created.join(", ")}`;
      }
      if (errors.length > 0) {
        text += `\nFailed: ${errors.join("; ")}`;
      }

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );
}

// ── Finalize Agent ────────────────────────────────────────────────────

function createFinalizeTool(ctx: CreatorContext) {
  return tool(
    "finalize_agent",
    "Finalize and save the agent. Call this ONLY when the user has confirmed they are happy with the configuration. For new agents, this activates them. For existing agents being edited, this saves all changes and completes the editing session.",
    {},
    async () => {
      const config = await ctx.convexClient.getAgentConfig(ctx.agentId);
      if (!config) {
        return {
          content: [
            { type: "text" as const, text: "Error: Agent not found." },
          ],
        };
      }

      // Validate completeness
      const issues: string[] = [];
      if (config.name === "New Agent") {
        issues.push("name is still the default — ask the user for a name");
      }
      if (
        !config.systemPrompt ||
        config.systemPrompt === "You are a helpful AI assistant."
      ) {
        issues.push(
          "system prompt is still the default — craft a custom one based on the conversation"
        );
      }
      if (!config.description) {
        issues.push("description is missing — add a short summary of what the agent does");
      }

      if (issues.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Cannot finalize yet. Please fix:\n${issues.map((i) => `- ${i}`).join("\n")}`,
            },
          ],
        };
      }

      await ctx.convexClient.finalizeAgent(ctx.agentId);
      return {
        content: [
          {
            type: "text" as const,
            text: `Agent "${config.name}" has been created and activated! The user can now find it on their dashboard.`,
          },
        ],
      };
    }
  );
}
