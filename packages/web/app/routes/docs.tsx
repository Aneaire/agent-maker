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

  Globe,
  Wrench,
  ChevronRight,
  ArrowLeft,
  Layers,
  Shield,
  Settings,
  Plug,
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
      {
        id: "templates",
        title: "Agent Templates",
        content: <TemplatesContent />,
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
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
      {
        id: "image-generation",
        title: "Image Generation",
        content: <ImageGenContent />,
      },
      {
        id: "postgres",
        title: "PostgreSQL",
        content: <PostgresContent />,
      },
      {
        id: "assets",
        title: "Asset Management",
        content: <AssetsContent />,
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: <Plug className="h-4 w-4" />,
    pages: [
      {
        id: "notion",
        title: "Notion",
        content: <NotionContent />,
      },
      {
        id: "slack",
        title: "Slack",
        content: <SlackContent />,
      },
      {
        id: "discord",
        title: "Discord",
        content: <DiscordContent />,
      },
      {
        id: "google-calendar",
        title: "Google Calendar",
        content: <GCalContent />,
      },
      {
        id: "google-drive",
        title: "Google Drive",
        content: <GDriveContent />,
      },
      {
        id: "google-sheets",
        title: "Google Sheets",
        content: <GSheetsContent />,
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
          icon={<Zap className="h-5 w-5" />}
          title="Event Bus"
          description="Chain actions: when X happens, do Y"
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
        headers={["Tool", "What It Does"]}
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
          ["Image Generation", "Generate images from text prompts (Gemini, Nano Banana)"],
          ["PostgreSQL", "Connect to external databases (Pro+)"],
        ]}
      />

      <DocH3>Integrations</DocH3>
      <DocP>
        Connect your agent to third-party services for even more power.
      </DocP>
      <DocTable
        headers={["Integration", "What It Does"]}
        rows={[
          ["Notion", "Search, read, create & update Notion pages/databases"],
          ["Slack", "Send messages, read channels, search & react in Slack"],
          ["Discord", "Send messages, read channels, manage threads & react in Discord"],
          ["Google Calendar", "List events, schedule meetings, check availability"],
          ["Google Drive", "Search, read, create & manage files and folders"],
          ["Google Sheets", "Read, write & manage spreadsheet data"],
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
      <DocH3>Notion</DocH3>
      <DocP>
        Enable "Notion", then add your Notion integration token in <strong className="text-zinc-200">Settings</strong>. Share the pages and databases you want accessed with the integration in Notion. Your agent can then search, read, create, and update Notion content.
      </DocP>
      <DocH3>Slack</DocH3>
      <DocP>
        Enable "Slack", then add your Slack Bot token in <strong className="text-zinc-200">Settings</strong>. Create a Slack app, add the required bot scopes, install to your workspace, and paste the Bot User OAuth Token.
      </DocP>
      <DocH3>Discord</DocH3>
      <DocP>
        Enable "Discord", then add your Discord Bot token in <strong className="text-zinc-200">Settings</strong>. Go to <strong className="text-zinc-200">discord.com/developers/applications</strong>, create an app, go to the Bot page, reset the token, and invite the bot to your server via OAuth2 → URL Generator.
      </DocP>
      <DocH3>Google Calendar</DocH3>
      <DocP>
        Enable "Google Calendar", then add your OAuth Client ID, Client Secret, and Refresh Token in <strong className="text-zinc-200">Settings</strong>. Your agent can then list events, schedule meetings, check availability, and manage your calendar.
      </DocP>
      <DocH3>Google Drive & Sheets</DocH3>
      <DocP>
        Enable "Google Drive" and/or "Google Sheets" and add your OAuth credentials. You can reuse the same Client ID and Secret from your Google Cloud project — just add the appropriate API scopes when generating the refresh token.
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
        ["notion.page_created", "A Notion page is created"],
        ["notion.page_updated", "A Notion page is updated"],
        ["slack.message_sent", "A message is posted to Slack"],
        ["discord.message_sent", "A message is sent to a Discord channel"],
        ["discord.thread_created", "A thread is created in Discord"],
        ["gcal.event_created", "A Google Calendar event is created"],
        ["gcal.event_updated", "A Google Calendar event is modified"],
        ["gdrive.file_created", "A Google Drive file is created"],
        ["gsheets.data_written", "Data is written to a Google Sheet"],
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

function NotionContent() {
  return (
    <div>
      <DocH1>Notion</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: notion</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Requires: Notion Integration Token</DocBadge>
      </div>
      <DocP>
        Connect your agent to Notion to search, read, create, and update pages and databases. Your agent can manage project trackers, knowledge bases, meeting notes, and any other Notion content.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        1. Create an internal integration at <strong className="text-zinc-200">notion.so/my-integrations</strong>. Copy the integration token.
      </DocP>
      <DocP>
        2. In your agent's <strong className="text-zinc-200">Settings</strong>, enable Notion and paste the token.
      </DocP>
      <DocP>
        3. In Notion, share the pages and databases you want the agent to access with your integration (click "..." on a page → "Add connections" → select your integration).
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["notion_search", "Search pages and databases by keyword"],
          ["notion_query_database", "Query a database with filters and sorting"],
          ["notion_create_page", "Create a new page or database entry"],
          ["notion_update_page", "Update page properties (status, dates, etc.)"],
          ["notion_get_page", "Read a page's properties and content"],
          ["notion_append_blocks", "Add text, headings, lists, todos to a page"],
        ]}
      />

      <DocH2>Querying Databases</DocH2>
      <DocP>
        Use <code className="text-zinc-200 bg-zinc-800 px-1 rounded">notion_query_database</code> with Notion filter objects to retrieve specific entries. The agent understands natural language — ask "show me all tasks marked Done" and it builds the right filter.
      </DocP>
      <DocCode>{`// Example filter: Status equals "Done"
{ "property": "Status", "status": { "equals": "Done" } }

// Example filter: Created in last 7 days
{ "property": "Created", "date": { "past_week": {} } }`}</DocCode>

      <DocH2>Creating Pages</DocH2>
      <DocP>
        Create pages as children of existing pages or as new entries in a database. For database entries, the agent sets properties matching the database schema (status, select, date, etc.).
      </DocP>

      <DocH2>Appending Content</DocH2>
      <DocP>
        Use <code className="text-zinc-200 bg-zinc-800 px-1 rounded">notion_append_blocks</code> to add content to existing pages. Supports paragraphs, headings (H1-H3), bulleted/numbered lists, to-do items, quotes, callouts, and dividers.
      </DocP>

      <DocH2>Events</DocH2>
      <DocP>
        Notion actions emit events to the <AppLink to="/docs/advanced/event-bus">Event Bus</AppLink>, so you can trigger automations when Notion content is created or updated.
      </DocP>
      <DocTable
        headers={["Event", "When"]}
        rows={[
          ["notion.searched", "A search is performed"],
          ["notion.page_created", "A new page is created"],
          ["notion.page_updated", "A page's properties are updated"],
          ["notion.database_queried", "A database is queried"],
          ["notion.blocks_appended", "Content is appended to a page"],
        ]}
      />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Add a new task to my Projects database: 'Launch landing page' with status In Progress and due date March 25"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Searches for the Projects database, then creates a new entry with the specified properties.
      </DocP>

      <DocH2>Integration Ideas</DocH2>
      <DocP>
        Combine with <AppLink to="/docs/tools/schedules">Scheduled Actions</AppLink> for daily syncs (e.g., "every morning, summarize my Notion tasks"). Use with <AppLink to="/docs/tools/automations">Automations</AppLink> to update Notion when events happen (e.g., "when email received → create Notion page").
      </DocP>
    </div>
  );
}

function SlackContent() {
  return (
    <div>
      <DocH1>Slack</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: slack</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Requires: Slack Bot Token</DocBadge>
      </div>
      <DocP>
        Connect your agent to Slack to send messages, read channels, search conversations, add reactions, and manage channel topics. Perfect for team notifications, status updates, and automated workflows.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        1. Create a Slack app at <strong className="text-zinc-200">api.slack.com/apps</strong>.
      </DocP>
      <DocP>
        2. Under <strong className="text-zinc-200">OAuth & Permissions</strong>, add these bot token scopes:
      </DocP>
      <DocCode>{`chat:write        — Send messages
channels:read     — List public channels
channels:history  — Read public channel messages
groups:read       — List private channels
groups:history    — Read private channel messages
reactions:write   — Add emoji reactions
search:read       — Search messages`}</DocCode>
      <DocP>
        3. Install the app to your workspace and copy the <strong className="text-zinc-200">Bot User OAuth Token</strong> (starts with xoxb-).
      </DocP>
      <DocP>
        4. In your agent's <strong className="text-zinc-200">Settings</strong>, enable Slack and paste the token.
      </DocP>
      <DocP>
        5. Invite the bot to channels it should access: type <code className="text-zinc-200 bg-zinc-800 px-1 rounded">/invite @YourBotName</code> in each channel.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["slack_send_message", "Send a message to a channel or thread"],
          ["slack_list_channels", "List available channels with IDs and topics"],
          ["slack_read_messages", "Read recent messages from a channel or thread"],
          ["slack_add_reaction", "Add an emoji reaction to a message"],
          ["slack_set_topic", "Set a channel's topic"],
          ["slack_search_messages", "Search messages across channels"],
        ]}
      />

      <DocH2>Sending Messages</DocH2>
      <DocP>
        Messages support Slack's mrkdwn formatting:
      </DocP>
      <DocCode>{`*bold*  _italic_  ~strikethrough~  \`code\`
> blockquote
• bullet list (use bullet character)
<https://example.com|Link Text>
:emoji_name:`}</DocCode>
      <DocP>
        To reply in a thread, pass the <code className="text-zinc-200 bg-zinc-800 px-1 rounded">thread_ts</code> parameter (the timestamp of the parent message).
      </DocP>

      <DocH2>Events</DocH2>
      <DocP>
        Slack actions emit events to the <AppLink to="/docs/advanced/event-bus">Event Bus</AppLink>:
      </DocP>
      <DocTable
        headers={["Event", "When"]}
        rows={[
          ["slack.message_sent", "A message is posted to Slack"],
          ["slack.topic_set", "A channel topic is updated"],
        ]}
      />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Post a summary of today's completed tasks to #team-updates"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Lists channels to find #team-updates, reads the task board, composes a summary, and posts it.
      </DocP>

      <DocH2>Integration Ideas</DocH2>
      <DocP>
        Combine with <AppLink to="/docs/tools/automations">Automations</AppLink> for event-driven Slack notifications (e.g., "when a task is completed → post to #done"). Use with <AppLink to="/docs/tools/schedules">Scheduled Actions</AppLink> for daily standups or weekly reports posted to Slack.
      </DocP>
    </div>
  );
}

function DiscordContent() {
  return (
    <div>
      <DocH1>Discord</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: discord</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Requires: Discord Bot Token</DocBadge>
      </div>
      <DocP>
        Connect your agent to Discord to send messages, read channels, manage threads, and add reactions. Perfect for community updates, automated notifications, and bot-powered workflows inside your Discord server.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        1. Go to <strong className="text-zinc-200">discord.com/developers/applications</strong> and click <strong className="text-zinc-200">New Application</strong>.
      </DocP>
      <DocP>
        2. In your new app, go to <strong className="text-zinc-200">Bot</strong> in the left sidebar. Click <strong className="text-zinc-200">Reset Token</strong> and copy the token.
      </DocP>
      <DocP>
        3. On the same Bot page, enable <strong className="text-zinc-200">Message Content Intent</strong> so the bot can read message content.
      </DocP>
      <DocP>
        4. Go to <strong className="text-zinc-200">OAuth2 → URL Generator</strong>. Check the <code className="text-zinc-200 bg-zinc-800 px-1 rounded">bot</code> scope, then check these permissions:
      </DocP>
      <DocCode>{`Send Messages
Read Message History
View Channels
Add Reactions
Create Public Threads
Send Messages in Threads`}</DocCode>
      <DocP>
        5. Copy the generated URL, open it in your browser, and invite the bot to your server.
      </DocP>
      <DocP>
        6. In your agent's <strong className="text-zinc-200">Settings</strong>, enable Discord and paste the Bot Token.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["discord_list_guilds", "List all servers the bot is a member of"],
          ["discord_list_channels", "List channels in a server — use this to find channel IDs"],
          ["discord_send_message", "Send a message to a channel (supports Discord markdown)"],
          ["discord_read_messages", "Read recent messages from a channel (up to 100)"],
          ["discord_add_reaction", "React to a message with an emoji (Unicode or custom)"],
          ["discord_create_thread", "Create a thread from a message or standalone in a channel"],
          ["discord_reply_in_thread", "Send a message inside an existing thread"],
        ]}
      />

      <DocH2>Sending Messages</DocH2>
      <DocP>
        Discord messages support markdown formatting:
      </DocP>
      <DocCode>{`**bold**  *italic*  ~~strikethrough~~  \`code\`
> blockquote
\`\`\`code block\`\`\`
- bullet list`}</DocCode>
      <DocP>
        Use <code className="text-zinc-200 bg-zinc-800 px-1 rounded">discord_list_guilds</code> first to find your server ID, then <code className="text-zinc-200 bg-zinc-800 px-1 rounded">discord_list_channels</code> to find a channel ID before sending.
      </DocP>

      <DocH2>Events</DocH2>
      <DocP>
        Discord actions emit events to the <AppLink to="/docs/advanced/event-bus">Event Bus</AppLink>:
      </DocP>
      <DocTable
        headers={["Event", "When"]}
        rows={[
          ["discord.message_sent", "A message or thread reply is sent"],
          ["discord.thread_created", "A new thread is created"],
        ]}
      />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Post the weekly summary to #general in my Discord server"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Lists guilds to find your server, lists channels to find #general's ID, then sends the message.
      </DocP>

      <DocH2>Integration Ideas</DocH2>
      <DocP>
        Combine with <AppLink to="/docs/tools/automations">Automations</AppLink> for event-driven Discord notifications (e.g., "when a task is completed → post to #updates"). Use with <AppLink to="/docs/tools/schedules">Scheduled Actions</AppLink> for daily digests or announcements posted to your server.
      </DocP>
    </div>
  );
}

function GCalContent() {
  return (
    <div>
      <DocH1>Google Calendar</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: google_calendar</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Requires: Google OAuth Credentials</DocBadge>
      </div>
      <DocP>
        Connect your agent to Google Calendar to view upcoming events, schedule meetings, check availability, and manage your calendar — all through natural conversation.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        1. Go to the <strong className="text-zinc-200">Google Cloud Console</strong> → APIs & Services → Enable the <strong className="text-zinc-200">Google Calendar API</strong>.
      </DocP>
      <DocP>
        2. Create an <strong className="text-zinc-200">OAuth 2.0 Client ID</strong> (Web application type). Note the Client ID and Client Secret.
      </DocP>
      <DocP>
        3. Use the <strong className="text-zinc-200">Google OAuth Playground</strong> (developers.google.com/oauthplayground) to authorize the <code className="text-zinc-200 bg-zinc-800 px-1 rounded">https://www.googleapis.com/auth/calendar</code> scope and obtain a Refresh Token.
      </DocP>
      <DocP>
        4. In your agent's <strong className="text-zinc-200">Settings</strong>, enable Google Calendar and enter all three credentials.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["gcal_list_calendars", "List all accessible calendars and their IDs"],
          ["gcal_list_events", "List upcoming events with optional date range and search"],
          ["gcal_create_event", "Create events with attendees, location, description, and Google Meet"],
          ["gcal_update_event", "Reschedule or modify existing events"],
          ["gcal_delete_event", "Cancel/delete events"],
          ["gcal_find_free_time", "Check free/busy availability across calendars"],
        ]}
      />

      <DocH2>Creating Events</DocH2>
      <DocP>
        Events support all-day dates (<code className="text-zinc-200 bg-zinc-800 px-1 rounded">2025-03-20</code>) or specific times (<code className="text-zinc-200 bg-zinc-800 px-1 rounded">2025-03-20T14:00:00-05:00</code>). Add attendees by email, set a location, and optionally attach a Google Meet link with <code className="text-zinc-200 bg-zinc-800 px-1 rounded">add_meet: true</code>.
      </DocP>

      <DocH2>Checking Availability</DocH2>
      <DocP>
        Use <code className="text-zinc-200 bg-zinc-800 px-1 rounded">gcal_find_free_time</code> to check when calendars are free or busy in a given time range. This is useful for finding open slots before scheduling meetings.
      </DocP>

      <DocH2>Events</DocH2>
      <DocP>
        Calendar actions emit events to the <AppLink to="/docs/advanced/event-bus">Event Bus</AppLink>:
      </DocP>
      <DocTable
        headers={["Event", "When"]}
        rows={[
          ["gcal.event_created", "A new calendar event is created"],
          ["gcal.event_updated", "An event is modified"],
          ["gcal.event_deleted", "An event is deleted"],
        ]}
      />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Schedule a team standup tomorrow at 10am for 30 minutes with alice@company.com and bob@company.com, add a Meet link"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Creates a calendar event with the specified time, attendees, and Google Meet conference link.
      </DocP>

      <DocH2>Integration Ideas</DocH2>
      <DocP>
        Combine with <AppLink to="/docs/integrations/slack">Slack</AppLink> to post daily agenda summaries. Use with <AppLink to="/docs/tools/schedules">Scheduled Actions</AppLink> for "every morning, check my calendar and brief me." Pair with <AppLink to="/docs/tools/timers">Timers</AppLink> for pre-meeting reminders.
      </DocP>
    </div>
  );
}

function GDriveContent() {
  return (
    <div>
      <DocH1>Google Drive</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: google_drive</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Requires: Google OAuth Credentials</DocBadge>
      </div>
      <DocP>
        Connect your agent to Google Drive to search, read, create, and manage files and folders. Your agent can access Google Docs, Sheets, PDFs, text files, and more.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        Use the same Google Cloud project as Calendar/Sheets. Enable the <strong className="text-zinc-200">Google Drive API</strong> and generate a refresh token with the <code className="text-zinc-200 bg-zinc-800 px-1 rounded">https://www.googleapis.com/auth/drive</code> scope. You can reuse the same Client ID and Secret.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["gdrive_search", "Search files by name or content with optional MIME type filter"],
          ["gdrive_list_files", "List files in a folder (defaults to root)"],
          ["gdrive_read_file", "Read text content — Docs export as text, Sheets as CSV"],
          ["gdrive_create_file", "Create Google Docs, Sheets, folders, or text files"],
          ["gdrive_move_file", "Move files between folders or rename them"],
          ["gdrive_delete_file", "Move a file to trash (recoverable)"],
        ]}
      />

      <DocH2>Reading Files</DocH2>
      <DocP>
        Google Workspace files (Docs, Sheets, Slides) are automatically exported to readable formats. Regular files (txt, csv, json, etc.) are downloaded directly. Very large files are truncated to 15,000 characters.
      </DocP>

      <DocH2>Events</DocH2>
      <DocTable
        headers={["Event", "When"]}
        rows={[
          ["gdrive.file_created", "A new file or folder is created"],
          ["gdrive.file_deleted", "A file is moved to trash"],
        ]}
      />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Find the Q1 report in my Drive and summarize it"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Searches Drive for "Q1 report", reads the document content, and provides a summary.
      </DocP>

      <DocH2>Integration Ideas</DocH2>
      <DocP>
        Pair with <AppLink to="/docs/integrations/google-sheets">Google Sheets</AppLink> for data workflows. Use with <AppLink to="/docs/tools/schedules">Scheduled Actions</AppLink> to generate weekly report documents. Combine with <AppLink to="/docs/integrations/slack">Slack</AppLink> to share Drive links in channels.
      </DocP>
    </div>
  );
}

function GSheetsContent() {
  return (
    <div>
      <DocH1>Google Sheets</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: google_sheets</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Requires: Google OAuth Credentials</DocBadge>
      </div>
      <DocP>
        Connect your agent to Google Sheets to read, write, and manage spreadsheet data. Perfect for data tracking, reporting, logging, and building data pipelines.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        Use the same Google Cloud project. Enable the <strong className="text-zinc-200">Google Sheets API</strong> and generate a refresh token with the <code className="text-zinc-200 bg-zinc-800 px-1 rounded">https://www.googleapis.com/auth/spreadsheets</code> scope.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["gsheets_create", "Create a new spreadsheet with optional sheet names and headers"],
          ["gsheets_get_info", "Get spreadsheet metadata — sheet names, row/column counts"],
          ["gsheets_read", "Read data from a range (A1 notation)"],
          ["gsheets_write", "Write/overwrite data in a specific range"],
          ["gsheets_append", "Append rows to the end of a sheet"],
          ["gsheets_clear", "Clear values from a range (keeps formatting)"],
        ]}
      />

      <DocH2>A1 Notation</DocH2>
      <DocP>
        Ranges use standard spreadsheet notation:
      </DocP>
      <DocCode>{`Sheet1!A1:D10   — Columns A-D, rows 1-10
Sheet1!A:C      — All of columns A-C
Sheet1          — Entire sheet
A1:B5           — First sheet, A1 to B5`}</DocCode>

      <DocH2>Reading Data</DocH2>
      <DocP>
        The <code className="text-zinc-200 bg-zinc-800 px-1 rounded">gsheets_read</code> tool returns data as a structured object with headers (first row) and rows. The agent can interpret column structure and answer questions about the data.
      </DocP>

      <DocH2>Writing Data</DocH2>
      <DocP>
        Use <code className="text-zinc-200 bg-zinc-800 px-1 rounded">gsheets_write</code> to overwrite a specific range, or <code className="text-zinc-200 bg-zinc-800 px-1 rounded">gsheets_append</code> to add rows at the bottom. Values are interpreted automatically — numbers, dates, and formulas are parsed.
      </DocP>

      <DocH2>Events</DocH2>
      <DocTable
        headers={["Event", "When"]}
        rows={[
          ["gsheets.spreadsheet_created", "A new spreadsheet is created"],
          ["gsheets.data_written", "Data is written to a range"],
          ["gsheets.rows_appended", "Rows are appended to a sheet"],
        ]}
      />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Create an expense tracker spreadsheet with columns Date, Description, Amount, Category, and add my lunch expense of $15 today"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Creates the spreadsheet with headers, then appends a row with today's date, "Lunch", 15, and "Food".
      </DocP>

      <DocH2>Integration Ideas</DocH2>
      <DocP>
        Use with <AppLink to="/docs/tools/schedules">Scheduled Actions</AppLink> for daily data collection (e.g., "every day, fetch API metrics and append to the tracking sheet"). Combine with <AppLink to="/docs/tools/email">Email</AppLink> to send spreadsheet summaries. Pair with <AppLink to="/docs/tools/automations">Automations</AppLink> to log events automatically.
      </DocP>
    </div>
  );
}

function EventBusContent() {
  return (
    <div>
      <DocH1>Event Bus</DocH1>
      <DocP>
        Every action your agent takes emits an event. You can use these events to trigger automations — for example, send an email when a task is completed, or fire a webhook when new data is added.
      </DocP>

      <DocH2>How It Works</DocH2>
      <DocP>
        When a tool runs (e.g. creating a task, sending an email), an event is emitted. If you have automations set up, they listen for these events and execute follow-up actions automatically.
      </DocP>

      <DocH2>Available Events</DocH2>
      <DocTable headers={["Event", "When It Fires"]} rows={[
        ["task.created", "A new task is created"],
        ["task.updated", "A task is updated (status, title, etc.)"],
        ["task.deleted", "A task is deleted"],
        ["email.sent", "An email is successfully sent"],
        ["webhook.received", "An incoming webhook is received"],
        ["webhook.fired", "An outgoing webhook is sent"],
        ["schedule.fired", "A scheduled action runs"],
        ["timer.fired", "A timer completes"],
        ["memory.stored", "A new memory is saved"],
        ["document.ready", "An uploaded document finishes processing"],
        ["agent_message.sent", "A message is sent to another agent"],
        ["agent_message.received", "A message is received from another agent"],
        ["notion.searched", "A Notion search is performed"],
        ["notion.page_created", "A Notion page is created"],
        ["notion.page_updated", "A Notion page's properties are updated"],
        ["notion.database_queried", "A Notion database is queried"],
        ["notion.blocks_appended", "Content is appended to a Notion page"],
        ["slack.message_sent", "A message is posted to Slack"],
        ["slack.topic_set", "A Slack channel topic is updated"],
        ["gcal.event_created", "A Google Calendar event is created"],
        ["gcal.event_updated", "A Google Calendar event is modified"],
        ["gcal.event_deleted", "A Google Calendar event is deleted"],
        ["gdrive.file_created", "A Google Drive file or folder is created"],
        ["gdrive.file_deleted", "A Google Drive file is moved to trash"],
        ["gsheets.spreadsheet_created", "A Google Sheets spreadsheet is created"],
        ["gsheets.data_written", "Data is written to a Google Sheet"],
        ["gsheets.rows_appended", "Rows are appended to a Google Sheet"],
      ]} />

      <DocH2>Example: Chain Actions Together</DocH2>
      <DocP>
        A single action can trigger a chain of follow-ups. For example: a task is marked done → automation sends a summary email → automation fires a webhook to Slack. Set these up in <AppLink to="/docs/tools/automations">Automations</AppLink>.
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
          ["Image Generation", "image_generation", "Disabled", "All"],
          ["Notion", "notion", "Disabled", "All"],
          ["Slack", "slack", "Disabled", "All"],
          ["Google Calendar", "google_calendar", "Disabled", "All"],
          ["Google Drive", "google_drive", "Disabled", "All"],
          ["Google Sheets", "google_sheets", "Disabled", "All"],
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
          ["notion.searched", "query, resultCount"],
          ["notion.page_created", "pageId, title, parentType"],
          ["notion.page_updated", "pageId, updatedProperties"],
          ["notion.database_queried", "databaseId, resultCount"],
          ["notion.blocks_appended", "pageId, blockCount"],
          ["slack.message_sent", "channel, ts, threadTs"],
          ["slack.topic_set", "channel, topic"],
          ["gcal.event_created", "eventId, title, start, end"],
          ["gcal.event_updated", "eventId, updatedFields"],
          ["gcal.event_deleted", "eventId"],
          ["gdrive.file_created", "fileId, name, type"],
          ["gdrive.file_deleted", "fileId"],
          ["gsheets.spreadsheet_created", "spreadsheetId, title"],
          ["gsheets.data_written", "spreadsheetId, range, rowCount"],
          ["gsheets.rows_appended", "spreadsheetId, rowCount"],
          ["image.generated", "assetId, name, provider, model, prompt"],
        ]}
      />

      <DocH2>Template Variables</DocH2>
      <DocP>
        Access payload fields in automation configs: <code className="text-zinc-200 bg-zinc-800 px-1 rounded">{"{{event.title}}"}</code>, <code className="text-zinc-200 bg-zinc-800 px-1 rounded">{"{{event.status}}"}</code>, <code className="text-zinc-200 bg-zinc-800 px-1 rounded">{"{{event.taskId}}"}</code>, etc.
      </DocP>
    </div>
  );
}

function ImageGenContent() {
  return (
    <div>
      <DocH1>Image Generation</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Tool set: image_generation</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Requires: API key</DocBadge>
      </div>
      <DocP>
        Generate images from text prompts using AI. Your agent can create illustrations, diagrams, logos, and more — all saved automatically to the <AppLink to="/docs/tools/assets">Asset Library</AppLink>.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        Enable <strong className="text-zinc-200">Image Generation</strong> in your agent's Settings. Then add a provider credential:
      </DocP>
      <DocTable
        headers={["Provider", "Credential", "Notes"]}
        rows={[
          ["Gemini Imagen", "Gemini API key", "High-quality output, supports aspect ratios"],
          ["Nano Banana", "Nano Banana API key", "Multiple model tiers (generate, generate-2, generate-pro)"],
        ]}
      />
      <DocP>
        You can select your preferred provider and model in the chat interface using the model selector.
      </DocP>

      <DocH2>Tools</DocH2>
      <DocTable
        headers={["Tool", "Description"]}
        rows={[
          ["generate_image", "Generate an image from a text prompt and save it to assets"],
          ["list_assets", "List all generated images and files in the asset library"],
        ]}
      />

      <DocH2>Parameters</DocH2>
      <DocH3>generate_image</DocH3>
      <DocTable
        headers={["Parameter", "Type", "Required"]}
        rows={[
          ["prompt", "string", "Yes"],
          ["name", "string", "Yes"],
          ["provider", '"gemini" | "nano_banana"', "No"],
          ["width", "number", "No (default: 1024)"],
          ["height", "number", "No (default: 1024)"],
          ["folder_id", "string", "No"],
        ]}
      />

      <DocH3>Nano Banana Models</DocH3>
      <DocTable
        headers={["Model", "Resolution", "Default Size"]}
        rows={[
          ["generate", "Basic", "1024×1024"],
          ["generate-2", "Custom resolution & format", "1024×1024"],
          ["generate-pro", "High resolution", "2048×2048"],
        ]}
      />

      <DocH2>Supported Aspect Ratios</DocH2>
      <DocP>When using Gemini, dimensions are automatically converted to aspect ratios: 16:9, 3:2, 4:3, 1:1, 3:4, 2:3, 9:16.</DocP>

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Generate a logo for my coffee shop called Bean There"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Generates image → saves to assets → returns preview with download link
      </DocP>

      <DocH2>Integration</DocH2>
      <DocP>
        Generated images are stored in the <AppLink to="/docs/tools/assets">Asset Library</AppLink> with full metadata (prompt, provider, model, dimensions). Combine with <AppLink to="/docs/tools/automations">Automations</AppLink> for workflows like "when a task is created → generate a thumbnail."
      </DocP>
    </div>
  );
}

function PostgresContent() {
  return (
    <div>
      <DocH1>PostgreSQL</DocH1>
      <div className="flex gap-2 mb-4">
        <DocBadge>Page type: postgres</DocBadge>
        <DocBadge>Default: Disabled</DocBadge>
        <DocBadge>Plan: Pro+</DocBadge>
      </div>
      <DocP>
        Connect your agent to an external PostgreSQL database. Create a PostgreSQL page to let your agent query and display live data from your database.
      </DocP>

      <DocH2>Setup</DocH2>
      <DocP>
        1. Create a new page and select <strong className="text-zinc-200">PostgreSQL</strong> as the page type (requires Pro or Enterprise plan).
      </DocP>
      <DocP>
        2. Enter your connection string in the page settings. The connection is tested and stored securely (encrypted at rest).
      </DocP>

      <DocH2>Features</DocH2>
      <DocTable
        headers={["Feature", "Description"]}
        rows={[
          ["Live connection", "Connect to any PostgreSQL database via connection string"],
          ["Status monitoring", "Track connection status (connected / disconnected / error)"],
          ["Query interface", "Read-only query interface for exploring data"],
          ["Encrypted storage", "Connection credentials are encrypted at rest"],
        ]}
      />

      <DocH2>Limits</DocH2>
      <DocTable
        headers={["Plan", "Max Connections"]}
        rows={[
          ["Free", "—"],
          ["Pro", "1 per agent"],
          ["Enterprise", "5 per agent"],
        ]}
      />

      <DocH2>Example</DocH2>
      <DocP>
        <strong className="text-zinc-200">User:</strong> "Show me all orders from the last 7 days"
      </DocP>
      <DocP>
        <strong className="text-zinc-200">Agent:</strong> Queries the connected database and displays results in a formatted table.
      </DocP>
    </div>
  );
}

function AssetsContent() {
  return (
    <div>
      <DocH1>Asset Management</DocH1>
      <DocP>
        The Asset Library is where your agent stores generated images and files. Access it from the <strong className="text-zinc-200">Assets</strong> tab in any agent.
      </DocP>

      <DocH2>Features</DocH2>
      <DocTable
        headers={["Feature", "Description"]}
        rows={[
          ["Grid & list views", "Browse assets visually or in a detailed list"],
          ["Folder organization", "Create nested folders to keep assets organized"],
          ["Image previews", "Full-size previews for generated images"],
          ["Metadata tracking", "Each asset stores its prompt, provider, model, and dimensions"],
          ["Rename & move", "Reorganize assets between folders"],
          ["Download", "Download any asset directly"],
        ]}
      />

      <DocH2>Asset Types</DocH2>
      <DocTable
        headers={["Type", "Source"]}
        rows={[
          ["image", "Generated via Image Generation tools"],
          ["file", "Uploaded or created by the agent"],
        ]}
      />

      <DocH2>How It Works</DocH2>
      <DocP>
        When your agent uses the <code className="text-zinc-200 bg-zinc-800 px-1 rounded">generate_image</code> tool, the resulting image is automatically saved to the Asset Library with full generation metadata. Use the <code className="text-zinc-200 bg-zinc-800 px-1 rounded">list_assets</code> tool to let your agent reference previously generated content.
      </DocP>

      <DocH2>Integration</DocH2>
      <DocP>
        Works hand-in-hand with <AppLink to="/docs/tools/image-generation">Image Generation</AppLink>. Generated assets can be referenced in <AppLink to="/docs/tools/pages">Pages</AppLink>, shared via <AppLink to="/docs/tools/email">Email</AppLink>, or posted to <AppLink to="/docs/integrations/slack">Slack</AppLink>.
      </DocP>
    </div>
  );
}

function TemplatesContent() {
  return (
    <div>
      <DocH1>Agent Templates</DocH1>
      <DocP>
        Templates give you a head start when creating a new agent. Each template comes pre-configured with a system prompt, enabled tools, and starter pages — ready to use out of the box.
      </DocP>

      <DocH2>Available Templates</DocH2>
      <DocTable
        headers={["Template", "Description", "Key Tools"]}
        rows={[
          ["Personal Assistant", "Daily planning, tasks, and reminders", "Memory, Pages, Schedules, Timers"],
          ["Journal & Reflection", "Guided journaling and mood tracking", "Memory, Pages"],
          ["Study Buddy", "Learning notes, Q&A practice, goal tracking", "Memory, Pages, Web Search"],
          ["Budget & Finance", "Budget tracking, expense analysis", "Memory, Pages"],
          ["Customer Support", "Support ticket workflow with escalation", "Memory, Pages, Custom HTTP, Webhooks"],
          ["Research Assistant", "Topic research and information organization", "Memory, Pages, Web Search, RAG"],
          ["Project Manager", "Task breakdown, progress tracking, team coordination", "Memory, Pages, Email, Schedules"],
          ["Writing Assistant", "Drafting, editing, and content creation", "Memory, Pages"],
          ["API Service Agent", "Expose your agent as REST API endpoints", "Pages, REST API, Custom HTTP"],
        ]}
      />

      <DocH2>How to Use</DocH2>
      <DocP>
        When creating a new agent via the <AppLink to="/agents/new">Creator</AppLink>, you can choose a template or build from scratch. The Creator Agent will walk you through customizing the template to your needs.
      </DocP>

      <DocH2>What Templates Include</DocH2>
      <DocTable
        headers={["Component", "Description"]}
        rows={[
          ["System prompt", "Pre-written personality and behavior guidelines"],
          ["Model selection", "Optimal Claude model for the use case"],
          ["Enabled tools", "Pre-configured tool sets relevant to the template"],
          ["Starter pages", "Initial task boards, notes, or data pages"],
          ["API endpoints", "Pre-defined endpoints (API Service template)"],
        ]}
      />

      <DocP>
        After applying a template, everything is fully customizable — change the name, tweak the prompt, add or remove tools, and modify pages as needed.
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
