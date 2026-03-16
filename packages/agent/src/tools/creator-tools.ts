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
  userPlan: string = "free"
) {
  const ctx: CreatorContext = { convexClient, agentId, userPlan };
  return [
    createUpdateConfigTool(ctx),
    createPreviewConfigTool(ctx),
    createListToolSetsTool(ctx),
    createUseTemplateTool(ctx),
    createStarterPagesTool(ctx),
    createFinalizeTool(ctx),
  ];
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
          'The Claude model to use. Options: "claude-sonnet-4-6" (fast, good for most tasks), "claude-opus-4-6" (most capable), "claude-haiku-4-5-20251001" (fastest, cheapest)'
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
  }
> = {
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

      const pagesNote =
        createdPages.length > 0
          ? `\n\nAlso created starter pages: ${createdPages.join(", ")}`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `Applied "${input.templateId}" template: ${template.name}.\nSet name, description, system prompt, model (${template.model}), and tool sets.${pagesNote}\n\nThe user can now customize any of these. Show them a summary and ask if they'd like to adjust anything.`,
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
              .enum(["tasks", "notes", "spreadsheet", "markdown", "data_table"])
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

// ── Finalize Agent ────────────────────────────────────────────────────

function createFinalizeTool(ctx: CreatorContext) {
  return tool(
    "finalize_agent",
    "Finalize and activate the agent. Call this ONLY when the user has confirmed they are happy with the configuration. This sets the agent to active and completes the creation process.",
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
