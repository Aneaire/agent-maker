import { DashboardLayout } from "~/components/DashboardLayout";
import { Link, useParams } from "react-router";
import {
  BookOpen,
  Brain,
  Search,
  FileText,
  Mail,
  Database,
  Clock,
  Zap,
  Timer,
  Webhook,
  MessageSquare,
  Network,
  Globe,
  Wrench,
  ChevronRight,
  ArrowLeft,
  Layers,
  Shield,
  Settings,
} from "lucide-react";
import { useState } from "react";

// ── Documentation content ────────────────────────────────────────────

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  pages: DocPage[];
}

interface DocPage {
  id: string;
  title: string;
  content: React.ReactNode;
}

const SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <BookOpen className="h-4 w-4" />,
    pages: [
      {
        id: "quick-start",
        title: "Quick Start Guide",
        content: <QuickStartContent />,
      },
    ],
  },
  {
    id: "tools",
    title: "Tool Sets",
    icon: <Wrench className="h-4 w-4" />,
    pages: [
      { id: "memory", title: "Memory", content: <MemoryContent /> },
      { id: "web-search", title: "Web Search", content: <WebSearchContent /> },
      { id: "pages", title: "Pages", content: <PagesContent /> },
      { id: "email", title: "Email", content: <EmailContent /> },
      { id: "rag", title: "Knowledge Base (RAG)", content: <RagContent /> },
      {
        id: "custom-http",
        title: "Custom HTTP Tools",
        content: <CustomHttpContent />,
      },
      {
        id: "schedules",
        title: "Scheduled Actions",
        content: <SchedulesContent />,
      },
      {
        id: "automations",
        title: "Automations",
        content: <AutomationsContent />,
      },
      { id: "timers", title: "Timers & Delays", content: <TimersContent /> },
      { id: "webhooks", title: "Webhooks", content: <WebhooksContent /> },
      {
        id: "agent-messages",
        title: "Inter-Agent Messaging",
        content: <AgentMessagesContent />,
      },
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    icon: <Layers className="h-4 w-4" />,
    pages: [
      {
        id: "event-bus",
        title: "Event Bus",
        content: <EventBusContent />,
      },
      { id: "rest-api", title: "REST API Endpoints", content: <RestApiContent /> },
      {
        id: "architecture",
        title: "Architecture",
        content: <ArchitectureContent />,
      },
    ],
  },
  {
    id: "reference",
    title: "Reference",
    icon: <FileText className="h-4 w-4" />,
    pages: [
      {
        id: "tool-sets",
        title: "All Tool Sets",
        content: <ToolSetsRefContent />,
      },
      { id: "events", title: "Event Types", content: <EventTypesContent /> },
      { id: "plans", title: "Plan Limits", content: <PlansContent /> },
    ],
  },
];

// ── Main Docs Page ───────────────────────────────────────────────────

export default function DocsPage() {
  const params = useParams();
  const sectionId = params.section;
  const pageId = params.page;

  // Find current page
  let currentSection: DocSection | undefined;
  let currentPage: DocPage | undefined;

  if (sectionId && pageId) {
    currentSection = SECTIONS.find((s) => s.id === sectionId);
    currentPage = currentSection?.pages.find((p) => p.id === pageId);
  } else if (sectionId) {
    // Check if sectionId matches a page in any section
    for (const section of SECTIONS) {
      const page = section.pages.find((p) => p.id === sectionId);
      if (page) {
        currentSection = section;
        currentPage = page;
        break;
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="flex gap-8 max-w-6xl mx-auto">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:block">
          <div className="sticky top-20 space-y-6">
            <Link
              to="/docs"
              className="flex items-center gap-2 text-sm font-semibold text-zinc-100 mb-4"
            >
              <BookOpen className="h-4 w-4" />
              Documentation
            </Link>
            {SECTIONS.map((section) => (
              <div key={section.id}>
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  {section.icon}
                  {section.title}
                </div>
                <ul className="space-y-0.5">
                  {section.pages.map((page) => {
                    const isActive = currentPage?.id === page.id;
                    return (
                      <li key={page.id}>
                        <Link
                          to={`/docs/${section.id}/${page.id}`}
                          className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                            isActive
                              ? "bg-zinc-800 text-zinc-100"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                          }`}
                        >
                          {page.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {currentPage ? (
            <div>
              <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
                <Link to="/docs" className="hover:text-zinc-300">
                  Docs
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-zinc-400">
                  {currentSection?.title}
                </span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-zinc-200">{currentPage.title}</span>
              </div>
              <div className="docs-content">{currentPage.content}</div>
            </div>
          ) : (
            <DocsIndex />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ── Docs Index (landing) ─────────────────────────────────────────────

function DocsIndex() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">
          Documentation
        </h1>
        <p className="text-zinc-400 text-lg">
          Everything you need to build powerful AI agents.
        </p>
      </div>

      {/* Quick links grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DocCard
          to="/docs/getting-started/quick-start"
          icon={<BookOpen className="h-5 w-5" />}
          title="Quick Start"
          description="Create your first agent in 5 minutes"
          color="from-blue-500/20 to-blue-600/10"
        />
        <DocCard
          to="/docs/tools/schedules"
          icon={<Clock className="h-5 w-5" />}
          title="Scheduled Actions"
          description="Make agents work autonomously on a schedule"
          color="from-amber-500/20 to-amber-600/10"
        />
        <DocCard
          to="/docs/tools/automations"
          icon={<Zap className="h-5 w-5" />}
          title="Automations"
          description="Event-driven rules: when X happens, do Y"
          color="from-purple-500/20 to-purple-600/10"
        />
        <DocCard
          to="/docs/advanced/event-bus"
          icon={<Network className="h-5 w-5" />}
          title="Event Bus"
          description="How all tools interconnect via events"
          color="from-neon-500/20 to-neon-600/10"
        />
      </div>

      {/* All sections */}
      {SECTIONS.map((section) => (
        <div key={section.id}>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-200 mb-3">
            {section.icon}
            {section.title}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {section.pages.map((page) => (
              <Link
                key={page.id}
                to={`/docs/${section.id}/${page.id}`}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors group"
              >
                <span className="text-sm text-zinc-300 group-hover:text-zinc-100">
                  {page.title}
                </span>
                <ChevronRight className="h-3 w-3 text-zinc-600 group-hover:text-zinc-400 ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocCard({
  to,
  icon,
  title,
  description,
  color,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <Link
      to={to}
      className={`relative overflow-hidden rounded-xl border border-zinc-800 hover:border-zinc-700 p-5 transition-all hover:shadow-lg group`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${color} opacity-50 group-hover:opacity-70 transition-opacity`}
      />
      <div className="relative">
        <div className="text-zinc-300 mb-2">{icon}</div>
        <h3 className="font-semibold text-zinc-100 mb-1">{title}</h3>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
    </Link>
  );
}

// ── Shared components ────────────────────────────────────────────────

function DocH1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl font-bold text-zinc-100 mb-4">{children}</h1>
  );
}
function DocH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-semibold text-zinc-200 mt-8 mb-3">
      {children}
    </h2>
  );
}
function DocH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-medium text-zinc-300 mt-6 mb-2">
      {children}
    </h3>
  );
}
function DocP({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-400 leading-relaxed mb-4">{children}</p>;
}
function DocCode({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto mb-4 font-mono">
      {children}
    </pre>
  );
}
function DocBadge({
  children,
  color = "zinc",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 mr-2">
      {children}
    </span>
  );
}
function AppLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-neon-400 hover:text-neon-300 underline underline-offset-2 decoration-neon-400/40 hover:decoration-neon-300/60 transition-colors"
    >
      {children}
    </Link>
  );
}

function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left py-2 px-3 text-zinc-400 font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/50">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page Contents ────────────────────────────────────────────────────

function QuickStartContent() {
  return (
    <div>
      <DocH1>Quick Start Guide</DocH1>
      <DocP>Create your first AI agent in 5 minutes.</DocP>

      <DocH2>1. Create an Agent</DocH2>
      <DocP>
        Go to <AppLink to="/agents/new">Create New Agent</AppLink>. The Creator Agent walks you through setup: choose a template or build from scratch, configure tools, set a personality, and finalize.
      </DocP>

      <DocH2>2. Enable Tool Sets</DocH2>
      <DocP>
        In your agent's <strong className="text-zinc-200">Settings</strong> page, toggle the capabilities you need.
      </DocP>
      <DocTable
        headers={["Tool Set", "What It Does"]}
        rows={[
          ["Memory", "Remember information across conversations"],
          ["Web Search", "Search the internet for current info"],
          ["Pages", "Create task boards, notes, spreadsheets"],
          ["Email", "Send emails via Resend"],
          ["Knowledge Base", "Search uploaded documents (PDF, DOCX)"],
          ["Custom HTTP", "Call any external API"],
          ["Scheduled Actions", "Run tasks on a schedule (cron)"],
          ["Automations", "Event-driven rules (when X → do Y)"],
          ["Timers", "Delayed actions and reminders"],
          ["Webhooks", "Send/receive webhooks"],
          ["Inter-Agent Messaging", "Agents talk to each other"],
        ]}
      />

      <DocH2>3. Chat with Your Agent</DocH2>
      <DocP>
        Go to your agent's chat and start a conversation. Your agent can answer questions, create pages, search the web, remember preferences, set up schedules, and more.
      </DocP>

      <DocH2>4. Set Up Integrations</DocH2>
      <DocH3>Email</DocH3>
      <DocP>
        Add your Resend API key and from address in your agent's <strong className="text-zinc-200">Settings</strong>. Your agent can now send emails.
      </DocP>
      <DocH3>Webhooks</DocH3>
      <DocP>
        Enable "Webhooks" and ask your agent to fire webhooks to external services, or set up incoming webhooks in the Tasks page config.
      </DocP>
      <DocH3>Scheduled Actions</DocH3>
      <DocP>
        Enable "Scheduled Actions" and tell your agent: "Check this API every hour" or "Send me a daily summary." The agent creates and manages the schedule.
      </DocP>
      <DocH3>Automations</DocH3>
      <DocP>
        Enable "Automations" and tell your agent: "When a task is completed, send me an email." The agent creates the automation rule.
      </DocP>
    </div>
  );
}

function MemoryContent() {
  return (
    <div>
      <DocH1>Memory</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: memory</DocBadge>
        <DocBadge>Default: Enabled</DocBadge>
      </div>
      <DocP>
        Persistent memory allows agents to store and recall information across conversations. When a user shares preferences, important details, or context, the agent saves it and references it later.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["store_memory", "Save information with an optional category"],
          ["recall_memory", "Full-text search across stored memories"],
          ["search_memories", "List all memories, optionally filtered"],
        ]}
      />

      <DocH2>Categories</DocH2>
      <DocP>
        Memories can be tagged with categories: <code className="text-zinc-200 bg-zinc-800 px-1 rounded">preference</code>, <code className="text-zinc-200 bg-zinc-800 px-1 rounded">work</code>, <code className="text-zinc-200 bg-zinc-800 px-1 rounded">project</code>, <code className="text-zinc-200 bg-zinc-800 px-1 rounded">contact</code>, or custom categories.
      </DocP>

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Remember that I prefer TypeScript and always use Tailwind"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent stores:</strong> Content with category "preference". In future conversations, the agent reads this memory and applies the preferences.
      </DocP>
    </div>
  );
}

function WebSearchContent() {
  return (
    <div>
      <DocH1>Web Search</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: web_search</DocBadge>
        <DocBadge>Default: Enabled</DocBadge>
      </div>
      <DocP>
        Allows agents to search the internet and fetch web pages for current information. These are native Claude Agent SDK tools.
      </DocP>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["WebSearch", "Search the web for current information"],
          ["WebFetch", "Fetch and read web pages"],
        ]}
      />
    </div>
  );
}

function PagesContent() {
  return (
    <div>
      <DocH1>Pages</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: pages</DocBadge>
        <DocBadge>Default: Enabled</DocBadge>
      </div>
      <DocP>
        Pages are structured workspaces that appear in the user's sidebar. Agents autonomously create and manage different page types.
      </DocP>

      <DocH2>Page Types</DocH2>
      <DocH3>Tasks</DocH3>
      <DocP>Kanban-style task boards with status (todo/in_progress/done) and priority (low/medium/high).</DocP>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["create_task", "Create a task with title, description, status, priority"],
        ["update_task", "Update any task field"],
        ["list_tasks", "List all tasks on a board"],
      ]} />

      <DocH3>Notes</DocH3>
      <DocP>Markdown note collections.</DocP>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["save_note", "Create a new note"],
        ["update_note", "Update title or content"],
        ["list_notes", "List all notes"],
      ]} />

      <DocH3>Spreadsheets (Pro+)</DocH3>
      <DocP>Structured data tables with typed columns (text, number, date, checkbox).</DocP>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["add_spreadsheet_column", "Define a typed column"],
        ["add_spreadsheet_row", "Add a row of data"],
        ["update_spreadsheet_row", "Update an existing row"],
        ["list_spreadsheet_data", "Get all columns and rows"],
      ]} />

      <DocH3>Markdown / Data Table</DocH3>
      <DocP>Static content pages.</DocP>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["write_page_content", "Write or overwrite full page content"],
      ]} />
    </div>
  );
}

function EmailContent() {
  return (
    <div>
      <DocH1>Email</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: email</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Requires: Resend API key</DocBadge>
      </div>
      <DocP>Send emails directly from your agent using the Resend API.</DocP>

      <DocH2>Setup</DocH2>
      <DocP>In your agent's <strong className="text-zinc-200">Settings</strong>, enable Email and configure your Resend API key, from email, and from name.</DocP>

      <DocH2>Tools</DocH2>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["send_email", "Send email with HTML, CC, BCC, reply-to support"],
      ]} />

      <DocH2>Parameters</DocH2>
      <DocTable headers={["Parameter", "Type", "Required"]} rows={[
        ["to", "string or string[]", "Yes"],
        ["subject", "string", "Yes"],
        ["body", "string (HTML)", "Yes"],
        ["cc", "string[]", "No"],
        ["bcc", "string[]", "No"],
        ["reply_to", "string", "No"],
      ]} />

      <DocH2>Integration</DocH2>
      <DocP>Combine with <AppLink to="/docs/tools/schedules">Scheduled Actions</AppLink> for recurring reports, or <AppLink to="/docs/tools/automations">Automations</AppLink> for event-driven notifications (e.g., "when task done → email team").</DocP>
    </div>
  );
}

function RagContent() {
  return (
    <div>
      <DocH1>Knowledge Base (RAG)</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: rag</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
      </div>
      <DocP>
        Upload documents and let your agent search them using vector similarity. Agents answer questions grounded in your actual content.
      </DocP>

      <DocH2>How It Works</DocH2>
      <DocP>
        Upload → Extract text → Chunk (2000 chars) → Embed via Gemini → Store vectors → Search by cosine similarity. Returns top 8 matching chunks with relevance scores.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["search_documents", "Vector search across uploaded documents"],
      ]} />

      <DocH2>Supported Files</DocH2>
      <DocP>PDF, Word (.docx), Plain text (.txt), Markdown (.md)</DocP>
    </div>
  );
}

function CustomHttpContent() {
  return (
    <div>
      <DocH1>Custom HTTP Tools</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: custom_http_tools</DocBadge>
        <DocBadge>Default: Enabled</DocBadge>
      </div>
      <DocP>
        Define custom API endpoints that your agent can call. Connect to any external service — CRMs, project management tools, internal APIs.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>In your agent's <strong className="text-zinc-200">Settings</strong> under <strong className="text-zinc-200">Custom HTTP Tools</strong>, click Add Tool. Configure name, method, endpoint URL, headers, and input schema.</DocP>

      <DocH2>Example: Slack</DocH2>
      <DocCode>{`Name: send_slack_message
Method: POST
Endpoint: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Input Schema: { "text": { "type": "string" } }`}</DocCode>
    </div>
  );
}

function SchedulesContent() {
  return (
    <div>
      <DocH1>Scheduled Actions</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: schedules</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
      </div>
      <DocP>
        Create recurring or one-time scheduled tasks. Agents work autonomously — checking APIs, sending reports, creating tasks on a schedule.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["create_schedule", "Create a new scheduled action"],
        ["list_schedules", "List all schedules and their status"],
        ["pause_schedule", "Pause an active schedule"],
        ["resume_schedule", "Resume a paused schedule"],
        ["delete_schedule", "Delete a schedule permanently"],
      ]} />

      <DocH2>Schedule Types</DocH2>
      <DocTable headers={["Type", "Format", "Example"]} rows={[
        ["Interval", '"every Nm/h/d"', '"every 5m", "every 1h", "every 1d"'],
        ["Cron", "Cron expression", '"0 9 * * 1" (Monday 9am)'],
        ["Once", "Runs once", "Single execution then completes"],
      ]} />

      <DocH2>Action Types</DocH2>
      <DocTable headers={["Action", "Config"]} rows={[
        ["run_prompt", '{ prompt: "Summarize today\'s tasks" }'],
        ["send_email", "{ to, subject, body }"],
        ["create_task", "{ tabId, title, description }"],
        ["fire_webhook", "{ url, payload }"],
      ]} />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Send me a daily summary of open tasks every morning at 9am"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent creates:</strong> A cron schedule "0 9 * * *" with send_email action.
      </DocP>

      <DocH2>Limits</DocH2>
      <DocTable headers={["Limit", "Value"]} rows={[
        ["Schedules per agent", "20"],
        ["Poll interval", "10 seconds"],
      ]} />
    </div>
  );
}

function AutomationsContent() {
  return (
    <div>
      <DocH1>Automations</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: automations</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
      </div>
      <DocP>
        Create event-driven rules: when something happens, automatically do something else. Chain multiple actions together for complex workflows.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["create_automation", "Create an event → action rule"],
        ["list_automations", "List all automation rules"],
        ["delete_automation", "Delete an automation"],
      ]} />

      <DocH2>Trigger Events</DocH2>
      <DocTable headers={["Event", "When"]} rows={[
        ["task.created", "A task is created"],
        ["task.updated", "A task is updated"],
        ["task.deleted", "A task is deleted"],
        ["email.sent", "An email is sent"],
        ["webhook.received", "An incoming webhook is received"],
        ["schedule.fired", "A scheduled action executes"],
        ["timer.fired", "A timer fires"],
        ["agent_message.received", "A message from another agent arrives"],
      ]} />

      <DocH2>Actions</DocH2>
      <DocTable headers={["Action", "Description"]} rows={[
        ["send_email", "Send an email"],
        ["create_task", "Create a task"],
        ["create_note", "Create a note"],
        ["fire_webhook", "Fire an outgoing webhook"],
        ["store_memory", "Store a memory"],
        ["run_prompt", "Agent processes a prompt"],
        ["trigger_agent", "Send message to another agent"],
        ["delay", "Wait before next action (max 1hr)"],
      ]} />

      <DocH2>Template Variables</DocH2>
      <DocP>
        Use <code className="text-zinc-200 bg-zinc-800 px-1 rounded">{"{{event.title}}"}</code>, <code className="text-zinc-200 bg-zinc-800 px-1 rounded">{"{{event.status}}"}</code>, etc. in action configs to reference the triggering event's data.
      </DocP>

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "When a task is marked done, email the team and post to Slack"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent creates:</strong> Automation with trigger <code className="text-zinc-200 bg-zinc-800 px-1 rounded">task.updated</code> (filter: status=done) → send_email + fire_webhook.
      </DocP>

      <DocH2>Limits</DocH2>
      <DocTable headers={["Limit", "Value"]} rows={[
        ["Automations per agent", "30"],
        ["Actions per automation", "10"],
        ["Max delay", "1 hour"],
      ]} />
    </div>
  );
}

function TimersContent() {
  return (
    <div>
      <DocH1>Timers & Delays</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: timers</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
      </div>
      <DocP>
        Set delayed actions — "do X after Y time." Useful for follow-ups, reminders, and drip sequences.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["set_timer", "Schedule a delayed action"],
        ["list_timers", "List all active timers"],
        ["cancel_timer", "Cancel a waiting timer"],
      ]} />

      <DocH2>Timer vs Schedule</DocH2>
      <DocTable headers={["Feature", "Timer", "Schedule"]} rows={[
        ["Runs", "Once", "Recurring or once"],
        ["Defined by", "Delay from now", "Cron or interval"],
        ["Use case", '"In 30 minutes..."', '"Every Monday..."'],
      ]} />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Remind me to check the deployment in 30 minutes"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Sets a 30-minute timer with send_message action.
      </DocP>

      <DocH2>Limits</DocH2>
      <DocTable headers={["Limit", "Value"]} rows={[
        ["Active timers per agent", "50"],
        ["Maximum delay", "30 days"],
        ["Poll interval", "5 seconds"],
      ]} />
    </div>
  );
}

function WebhooksContent() {
  return (
    <div>
      <DocH1>Webhooks</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: webhooks</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
      </div>
      <DocP>
        Send and receive webhooks to integrate with external services — Slack, Discord, Zapier, n8n, Make, and any system that speaks HTTP.
      </DocP>

      <DocH2>Agent Tools</DocH2>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["fire_webhook", "Send a POST request to any URL"],
        ["list_events", "View recent events in the event bus"],
      ]} />

      <DocH2>Incoming Webhooks</DocH2>
      <DocP>
        External services POST to <code className="text-zinc-200 bg-zinc-800 px-1 rounded">/webhook/:secret</code> to create tasks or trigger automations. Configure in the Tasks page webhook settings.
      </DocP>

      <DocH2>Outgoing Webhooks</DocH2>
      <DocP>
        Automatically fire when task events occur. Configure per-page with target URL and event types (task.created, task.updated, task.deleted).
      </DocP>

      <DocH2>Limits</DocH2>
      <DocTable headers={["Limit", "Value"]} rows={[
        ["Webhooks per page", "10"],
        ["Request timeout", "15 seconds"],
      ]} />
    </div>
  );
}

function AgentMessagesContent() {
  return (
    <div>
      <DocH1>Inter-Agent Messaging</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: agent_messages</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
      </div>
      <DocP>
        Agents communicate with other agents owned by the same user. Enables multi-agent workflows, delegation, specialization, and coordination.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable headers={["Tool", "Description"]} rows={[
        ["list_sibling_agents", "List other agents you can message"],
        ["send_to_agent", "Send a message + optional context"],
        ["check_agent_messages", "Check for pending messages"],
        ["respond_to_agent", "Reply and mark as processed"],
      ]} />

      <DocH2>Use Cases</DocH2>
      <DocP>
        <strong className="text-zinc-200">Router Agent:</strong> Routes work to specialized agents based on the request type.
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Delegation:</strong> PM agent asks research agent for competitive analysis.
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Pipeline:</strong> Data agent → Analysis agent → Report agent.
      </DocP>

      <DocH2>Limits</DocH2>
      <DocTable headers={["Limit", "Value"]} rows={[
        ["Pending messages per agent", "50"],
        ["Message content", "10,000 chars"],
      ]} />
    </div>
  );
}

function EventBusContent() {
  return (
    <div>
      <DocH1>Event Bus</DocH1>
      <DocP>
        The event bus is the interconnection layer that ties all tools together. Every significant action emits an event, and automations subscribe to those events.
      </DocP>

      <DocH2>Flow</DocH2>
      <DocCode>{`Tool Action → Event Emitted → Automations Checked → Actions Executed
                            → Outgoing Webhooks Fired
                            → Event Logged for History`}</DocCode>

      <DocH2>All Event Types</DocH2>
      <DocTable headers={["Event", "Sources"]} rows={[
        ["task.created", "page_tools, webhook, automation, scheduler"],
        ["task.updated", "page_tools, webhook, automation"],
        ["task.deleted", "page_tools, webhook"],
        ["email.sent", "email_tools, automation, scheduler, timer"],
        ["email.failed", "email_tools"],
        ["webhook.received", "webhook"],
        ["webhook.fired", "webhook_tools, automation, scheduler"],
        ["schedule.fired", "scheduler"],
        ["timer.fired", "timer"],
        ["memory.stored", "memory_tools, automation"],
        ["document.ready", "document_processor"],
        ["agent_message.sent", "agent_message_tools, automation"],
        ["agent_message.received", "agent_message_tools"],
      ]} />

      <DocH2>Example Chain</DocH2>
      <DocP>
        A single incoming webhook can cascade through the entire system: webhook.received → task.created → send_email + fire_webhook — four tool systems interconnected through the event bus.
      </DocP>
    </div>
  );
}

function RestApiContent() {
  return (
    <div>
      <DocH1>REST API Endpoints</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Pro+ only</DocBadge>
      </div>
      <DocP>
        Expose your agent as a REST API. External systems send HTTP requests, and your agent processes them and returns structured responses.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        Create an API page → Define endpoints → Generate API key → Call <code className="text-zinc-200 bg-zinc-800 px-1 rounded">POST /api/{"{agentId}"}/{"{endpointSlug}"}</code>.
      </DocP>

      <DocH2>Authentication</DocH2>
      <DocP>
        Pass API key via <code className="text-zinc-200 bg-zinc-800 px-1 rounded">Authorization: Bearer YOUR_KEY</code> header or <code className="text-zinc-200 bg-zinc-800 px-1 rounded">?api_key=YOUR_KEY</code> query parameter.
      </DocP>
    </div>
  );
}

function ArchitectureContent() {
  return (
    <div>
      <DocH1>Architecture</DocH1>

      <DocH2>System Overview</DocH2>
      <DocCode>{`Web UI (React) ←→ Convex (Backend DB) ←→ Agent Server (Hono + SDK)
                                                    │
                                        ┌───────────┼───────────┐
                                        │           │           │
                                   Job Poller  Cron Poller  Timer Poller
                                    (2 sec)    (10 sec)     (5 sec)`}</DocCode>

      <DocH2>Packages</DocH2>
      <DocTable headers={["Package", "Technology", "Purpose"]} rows={[
        ["packages/web", "React 19 + React Router", "Frontend dashboard, chat, settings"],
        ["packages/shared", "Convex", "Database, queries, mutations, auth"],
        ["packages/agent", "Hono + Claude SDK", "Agent runtime, tools, scheduling"],
      ]} />

      <DocH2>Tool Architecture</DocH2>
      <DocP>
        Tools are registered as MCP tools via Claude Agent SDK. Each tool set is gated by the agent's <code className="text-zinc-200 bg-zinc-800 px-1 rounded">enabledToolSets</code> array. Tools are dynamically loaded based on agent configuration.
      </DocP>

      <DocH2>Auth Model</DocH2>
      <DocP>
        Two auth paths: <strong className="text-zinc-200">User-facing</strong> (Clerk JWT) and <strong className="text-zinc-200">Server-facing</strong> (shared server token). The agent server uses HTTP client with server token auth.
      </DocP>
    </div>
  );
}

function ToolSetsRefContent() {
  return (
    <div>
      <DocH1>All Tool Sets</DocH1>
      <DocTable
        headers={["Tool Set", "Key", "Default", "Plan"]}
        rows={[
          ["Memory", "memory", "Enabled", "All"],
          ["Web Search", "web_search", "Enabled", "All"],
          ["Pages", "pages", "Enabled", "All"],
          ["Custom HTTP Tools", "custom_http_tools", "Enabled", "All"],
          ["Email", "email", "Disabled", "All"],
          ["Knowledge Base", "rag", "Disabled", "All"],
          ["Scheduled Actions", "schedules", "Disabled", "All"],
          ["Automations", "automations", "Disabled", "All"],
          ["Timers & Delays", "timers", "Disabled", "All"],
          ["Webhooks", "webhooks", "Disabled", "All"],
          ["Inter-Agent Messaging", "agent_messages", "Disabled", "All"],
          ["REST API", "rest_api", "Disabled", "Pro+"],
          ["PostgreSQL", "postgres", "Disabled", "Pro+"],
        ]}
      />
    </div>
  );
}

function EventTypesContent() {
  return (
    <div>
      <DocH1>Event Types</DocH1>
      <DocP>All events emitted by the event bus. Use these as automation triggers.</DocP>

      <DocTable
        headers={["Event", "Payload Fields"]}
        rows={[
          ["task.created", "taskId, title, description, status, priority"],
          ["task.updated", "taskId, title, status, priority"],
          ["task.deleted", "taskId, title"],
          ["note.created", "noteId, title"],
          ["note.updated", "noteId, title"],
          ["email.sent", "to, subject, resendId"],
          ["email.failed", "to, subject, error"],
          ["webhook.received", "webhookId, action, body"],
          ["webhook.fired", "url, event, status"],
          ["schedule.fired", "actionId, actionName, success, result"],
          ["timer.fired", "timerId, label, actionType"],
          ["memory.stored", "content, category"],
          ["document.ready", "documentId, fileName, chunkCount"],
          ["agent_message.sent", "toAgentId, messageId"],
          ["agent_message.received", "fromAgentId, messageId"],
        ]}
      />

      <DocH2>Template Variables</DocH2>
      <DocP>
        Access payload fields in automation configs: <code className="text-zinc-200 bg-zinc-800 px-1 rounded">{"{{event.title}}"}</code>, <code className="text-zinc-200 bg-zinc-800 px-1 rounded">{"{{event.status}}"}</code>, <code className="text-zinc-200 bg-zinc-800 px-1 rounded">{"{{event.taskId}}"}</code>, etc.
      </DocP>
    </div>
  );
}

function PlansContent() {
  return (
    <div>
      <DocH1>Plan Limits</DocH1>

      <DocH2>Plans</DocH2>
      <DocTable
        headers={["Feature", "Free", "Pro", "Enterprise"]}
        rows={[
          ["Agents", "3", "10", "Unlimited"],
          ["Pages per agent", "5", "20", "50"],
          ["Spreadsheets", "—", "Yes", "Yes"],
          ["PostgreSQL", "—", "Yes", "Yes"],
          ["API Endpoints", "—", "Yes", "Yes"],
        ]}
      />

      <DocH2>Resource Limits</DocH2>
      <DocTable
        headers={["Resource", "Limit"]}
        rows={[
          ["Tasks per page", "500"],
          ["Notes per page", "200"],
          ["Spreadsheet rows", "10,000"],
          ["Webhooks per page", "10"],
          ["Schedules per agent", "20"],
          ["Automations per agent", "30"],
          ["Active timers", "50"],
          ["API endpoints per page", "20"],
          ["Pending agent messages", "50"],
        ]}
      />
    </div>
  );
}
