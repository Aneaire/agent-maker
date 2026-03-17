import { useMutation } from "convex/react";
import { api } from "@agent-maker/shared/convex/_generated/api";
import { useNavigate } from "react-router";
import { useState } from "react";
import {
  Wand2,
  Bot,
  Headphones,
  Search,
  FolderKanban,
  PenTool,
  BarChart3,
  Globe,
  ChevronLeft,
  Loader2,
  ArrowRight,
  Sparkles,
  LayoutTemplate,
} from "lucide-react";
import { Link } from "react-router";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  systemPrompt: string;
  model: string;
  enabledToolSets: string[];
  starterPages: Array<{ label: string; type: string }>;
  starterEndpoints?: Array<{
    tabLabel: string;
    name: string;
    method: string;
    description?: string;
    promptTemplate: string;
    responseFormat?: string;
  }>;
}

const TEMPLATES: Template[] = [
  {
    id: "customer_support",
    name: "Support Agent",
    description:
      "Friendly customer support agent with ticket tracking and a knowledge base",
    icon: Headphones,
    color: "from-blue-500/20 to-blue-600/5 ring-blue-500/20",
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
  {
    id: "research_assistant",
    name: "Research Assistant",
    description:
      "Thorough researcher that finds, analyzes, and organizes information",
    icon: Search,
    color: "from-neon-500/20 to-neon-600/5 ring-neon-500/20",
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
  {
    id: "project_manager",
    name: "Project Manager",
    description:
      "Organized project manager that tracks tasks, deadlines, and progress",
    icon: FolderKanban,
    color: "from-amber-500/20 to-amber-600/5 ring-amber-500/20",
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
  {
    id: "writing_assistant",
    name: "Writing Assistant",
    description:
      "Creative writing assistant for drafting, editing, and improving content",
    icon: PenTool,
    color: "from-purple-500/20 to-purple-600/5 ring-purple-500/20",
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
  {
    id: "data_analyst",
    name: "Data Analyst",
    description:
      "Analytical assistant that helps organize, track, and analyze data",
    icon: BarChart3,
    color: "from-rose-500/20 to-rose-600/5 ring-rose-500/20",
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
  {
    id: "api_service",
    name: "API Service Agent",
    description:
      "REST API agent with full page access for external integrations and automation",
    icon: Globe,
    color: "from-cyan-500/20 to-cyan-600/5 ring-cyan-500/20",
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
    enabledToolSets: [
      "memory",
      "web_search",
      "pages",
      "custom_http_tools",
      "rest_api",
    ],
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
        description:
          "List all rows from the Data spreadsheet, with optional filtering via query params",
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
        description:
          "Query a single record from the Data spreadsheet by matching a field value",
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
        description:
          "Add a new row to the Data spreadsheet from request body",
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
];

export default function NewAgentPage() {
  const navigate = useNavigate();
  const createFromTemplate = useMutation(api.agents.createFromTemplate);
  const [creating, setCreating] = useState<string | null>(null);

  async function handleTemplateSelect(template: Template) {
    setCreating(template.id);
    try {
      const agentId = await createFromTemplate({
        name: template.name,
        description: template.description,
        systemPrompt: template.systemPrompt,
        model: template.model,
        enabledToolSets: template.enabledToolSets,
        starterPages: template.starterPages,
        starterEndpoints: template.starterEndpoints,
      });
      navigate(`/agents/${agentId}`);
    } catch (err: any) {
      alert(err.message);
      setCreating(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800/60">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Dashboard
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="text-sm font-medium">New Agent</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight">
            Create a New Agent
          </h1>
          <p className="mt-3 text-zinc-400 text-base">
            Start from a template or build a custom agent with AI guidance
          </p>
        </div>

        {/* Build with AI Card */}
        <div className="mb-10">
          <Link
            to="/agents/new/creator"
            className="group block rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 p-6 hover:border-zinc-600 hover:from-zinc-800/80 hover:to-zinc-900/80 transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-600/5 ring-1 ring-violet-500/20">
                <Wand2 className="h-7 w-7 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Build with AI</h2>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  Chat with an AI assistant that guides you through creating a
                  fully customized agent — name, personality, tools, pages, and
                  API endpoints
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
            </div>
          </Link>
        </div>

        {/* Templates Section */}
        <div>
          <div className="flex items-center gap-2 mb-5">
            <LayoutTemplate className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              Templates
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((template) => {
              const Icon = template.icon;
              const isCreating = creating === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  disabled={creating !== null}
                  className="group text-left rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 hover:border-zinc-600 hover:bg-zinc-900/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${template.color} ring-1`}
                    >
                      {isCreating ? (
                        <Loader2 className="h-5 w-5 text-zinc-300 animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5 text-zinc-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold group-hover:text-white transition-colors">
                        {template.name}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500 leading-relaxed line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  {/* Pages preview */}
                  <div className="mt-3 flex flex-wrap gap-1.5 ml-15">
                    {template.starterPages.map((page) => (
                      <span
                        key={page.label}
                        className="text-[10px] text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full"
                      >
                        {page.label}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
