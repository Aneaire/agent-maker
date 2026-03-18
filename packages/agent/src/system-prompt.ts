interface AgentConfig {
  name: string;
  systemPrompt: string;
  description?: string;
  enabledToolSets?: string[];
}

interface Memory {
  content: string;
  category?: string;
}

interface Tab {
  _id: string;
  type: string;
  label: string;
}

function has(sets: string[], name: string): boolean {
  return sets.includes(name);
}

interface DocumentInfo {
  fileName: string;
}

interface ScheduleInfo {
  name: string;
  schedule: string;
  status: string;
}

interface AutomationInfo {
  name: string;
  trigger: { event: string };
  isActive: boolean;
}

export function buildSystemPrompt(
  agentConfig: AgentConfig,
  memories: Memory[],
  tabs: Tab[] = [],
  customToolNames: string[] = [],
  conversationHistory: string = "",
  documents: DocumentInfo[] = [],
  schedules: ScheduleInfo[] = [],
  automations: AutomationInfo[] = []
): string {
  const enabled = agentConfig.enabledToolSets ?? [];

  // ── Memory section (only if memory toolset is enabled) ──────────────
  const memorySection =
    has(enabled, "memory") && memories.length > 0
      ? `\n\n## Your Memories\nThese are things you've remembered:\n${memories.map((m) => `- ${m.content}${m.category ? ` [${m.category}]` : ""}`).join("\n")}\n`
      : "";

  // ── Pages section (only if pages toolset is enabled) ────────────────
  let tabSection = "";
  if (has(enabled, "pages")) {
    tabSection =
      tabs.length > 0
        ? `\n\n## Your Pages\nYou have these pages available (visible in the user's sidebar):\n${tabs.map((t) => `- "${t.label}" (type: ${t.type}, ID: ${t._id})`).join("\n")}\nYou can interact with these pages using your tools. You can also create new pages with create_page.\n`
        : "\n\n## Pages\nYou currently have no extra pages. Use create_page to create task boards, notes, spreadsheets, or markdown pages when useful.\n";
  }

  // ── Knowledge Base section (only if rag is enabled + docs exist) ────
  const knowledgeBaseSection =
    has(enabled, "rag") && documents.length > 0
      ? `\n\n## Knowledge Base\nYou have access to ${documents.length} uploaded document${documents.length > 1 ? "s" : ""}:\n${documents.map((d) => `- ${d.fileName}`).join("\n")}\nUse the \`search_documents\` tool to find information from these documents before answering questions about their content.\n`
      : "";

  // ── Custom tools section (only if custom_http_tools is enabled) ─────
  const customToolSection =
    has(enabled, "custom_http_tools") && customToolNames.length > 0
      ? `\n\n## Custom Tools\nYou have these custom HTTP tools: ${customToolNames.join(", ")}\n`
      : "";

  // ── Schedules section (only if schedules is enabled) ────────────────
  const schedulesSection =
    has(enabled, "schedules") && schedules.length > 0
      ? `\n\n## Active Schedules\nYou have these scheduled actions running:\n${schedules.map((s) => `- "${s.name}" — ${s.schedule} [${s.status}]`).join("\n")}\nManage them with create_schedule, list_schedules, pause_schedule, resume_schedule, delete_schedule.\n`
      : "";

  // ── Automations section (only if automations is enabled) ────────────
  const automationsSection =
    has(enabled, "automations") && automations.length > 0
      ? `\n\n## Active Automations\nYou have these automation rules:\n${automations.filter(a => a.isActive).map((a) => `- "${a.name}" — triggers on: ${a.trigger.event}`).join("\n")}\nManage them with create_automation, list_automations, delete_automation.\n`
      : "";

  // ── Capabilities list (only advertise what's enabled) ───────────────
  const capabilities: string[] = [];
  if (has(enabled, "web_search")) {
    capabilities.push(
      "- **Web Search & Fetch** — search the internet and fetch web pages"
    );
  }
  if (has(enabled, "memory")) {
    capabilities.push(
      "- **Memory** — store, recall, and search information across conversations"
    );
  }
  if (has(enabled, "pages")) {
    capabilities.push(
      "- **Pages** — create and manage task boards, notes, spreadsheets, and markdown pages"
    );
  }
  if (has(enabled, "rag")) {
    capabilities.push(
      "- **Knowledge Base** — search uploaded documents for relevant information"
    );
  }
  if (has(enabled, "email")) {
    capabilities.push(
      "- **Email** — send emails to users and contacts"
    );
  }
  if (has(enabled, "custom_http_tools")) {
    capabilities.push(
      `- **Custom HTTP Tools** — call external APIs configured by your owner${customToolNames.length > 0 ? ` (${customToolNames.length} configured)` : ""}`
    );
  }
  if (has(enabled, "schedules")) {
    capabilities.push(
      "- **Scheduled Actions** — create recurring or one-time scheduled tasks (cron jobs, intervals)"
    );
  }
  if (has(enabled, "automations")) {
    capabilities.push(
      "- **Automations** — create event-driven rules (when X happens → do Y automatically)"
    );
  }
  if (has(enabled, "timers")) {
    capabilities.push(
      "- **Timers** — set delayed actions (follow-ups, reminders, drip sequences)"
    );
  }
  if (has(enabled, "webhooks")) {
    capabilities.push(
      "- **Webhooks** — fire outgoing webhooks to external services, view event history"
    );
  }
  if (has(enabled, "agent_messages")) {
    capabilities.push(
      "- **Inter-Agent Messaging** — communicate with other agents for delegation and coordination"
    );
  }
  if (has(enabled, "notion")) {
    capabilities.push(
      "- **Notion** — search, read, create, and update pages and databases in the user's Notion workspace"
    );
  }

  const capabilitiesSection =
    capabilities.length > 0
      ? `\n## Capabilities\nYou have access to:\n${capabilities.join("\n")}\n`
      : "";

  // ── Autonomy guidelines (only if pages is enabled) ──────────────────
  const autonomySection = has(enabled, "pages")
    ? `
## Autonomy Guidelines
- **Be proactive**: When the user needs to track something, create a Tasks page. When they share data, create a Spreadsheet. When they need documentation, create a Notes or Markdown page.
- **Set up everything**: When creating a spreadsheet, define the columns first (using add_spreadsheet_column) before adding rows. Design the schema based on what makes sense for the data.
- **Manage fully**: Don't just create pages — populate them. If the user asks to track expenses, create the spreadsheet, add the columns (Date, Description, Amount, Category), and add the rows they mention.
`
    : "";

  // ── Scheduling guidelines ───────────────────────────────────────────
  const scheduleGuidance = has(enabled, "schedules") || has(enabled, "timers")
    ? `
## Scheduling & Timers
- When the user says "remind me", "every day", "check daily", "follow up in", etc., use the appropriate scheduling tool
- **Recurring tasks**: Use \`create_schedule\` with interval or cron
- **One-time delays**: Use \`set_timer\` with delay_minutes
- **Proactive setup**: If the user describes a workflow that needs recurring checks, suggest setting up a schedule
`
    : "";

  // ── Automation guidelines ───────────────────────────────────────────
  const automationGuidance = has(enabled, "automations")
    ? `
## Automations
- When the user says "when X happens, do Y" or "automatically do Z whenever...", create an automation
- Automations can chain multiple actions: e.g., "when a task is done → send email + create note"
- Use template variables in action configs: {{event.title}}, {{event.status}}, etc.
`
    : "";

  // ── Inter-agent guidelines ──────────────────────────────────────────
  const agentMessageGuidance = has(enabled, "agent_messages")
    ? `
## Inter-Agent Communication
- You can delegate work to other agents owned by the same user
- Use \`list_sibling_agents\` to see available agents, then \`send_to_agent\` to communicate
- Check for incoming messages with \`check_agent_messages\` and respond with \`respond_to_agent\`
- This is useful for specialized workflows: e.g., routing support tickets, triggering data analysis
`
    : "";

  // ── Notion guidelines ──────────────────────────────────────────────
  const notionGuidance = has(enabled, "notion")
    ? `
## Notion Integration
- Use \`notion_search\` to find pages and databases by keyword
- Use \`notion_query_database\` to list and filter entries in a Notion database — you can filter by status, date, tags, etc.
- Use \`notion_create_page\` to add new pages or database entries
- Use \`notion_update_page\` to change properties on existing pages (status, assignee, dates, etc.)
- Use \`notion_get_page\` to read a page's properties and content
- Use \`notion_append_blocks\` to add paragraphs, headings, lists, todos, or quotes to a page
- When the user mentions Notion content, search for it first rather than asking for IDs
- Property values in create/update must match Notion's property format (e.g. \`{ "Status": { "status": { "name": "Done" } } }\`)
`
    : "";

  // ── Custom tools guidance (only if enabled) ─────────────────────────
  const customToolGuidance = has(enabled, "custom_http_tools")
    ? `
## When You Can't Do Something
If the user asks you to do something you don't have the tools for (e.g. send an email, connect to a specific API, access a database), do the following:

1. Explain what you can't do and why
2. **Generate a ready-to-paste tool configuration** the user can add in Settings > Custom HTTP Tools:

\`\`\`
Tool Name: [snake_case_name]
Method: [GET/POST/PUT/DELETE]
Endpoint: [the URL]
Description: [what it does]
\`\`\`

Tell them: *"Go to your agent's Settings page, scroll to Custom HTTP Tools, and add this configuration. Once added, I'll be able to use it in our next conversation."*
`
    : "";

  return `${agentConfig.systemPrompt}${conversationHistory}${memorySection}${tabSection}${knowledgeBaseSection}${customToolSection}${schedulesSection}${automationsSection}${capabilitiesSection}${autonomySection}${scheduleGuidance}${automationGuidance}${agentMessageGuidance}${notionGuidance}${customToolGuidance}
## Interactive Questions
When you need the user to choose between options (onboarding, preferences, configuration), use the \`ask_questions\` tool INSTEAD of writing numbered questions in plain text. This renders clickable option cards the user can select from. Do NOT duplicate the questions in your text — the tool handles display. Use this whenever you'd otherwise write "do you want A, B, or C?"

## Suggested Follow-ups
At the END of your response, call the \`suggest_replies\` tool to offer 2-4 clickable follow-up options for the user. These should be:
- Specific and contextually relevant to what was just discussed
- Actionable (things the user would actually want to do next)
- Concise (under 60 characters each)
- NOT generic like "Tell me more" — instead be specific like "Add a priority column" or "Search for similar properties"

## General Guidelines${has(enabled, "memory") ? "\n- When the user shares preferences or important information, store it in memory" : ""}
- Keep responses concise but informative
- If a tool fails, explain what happened and suggest alternatives${has(enabled, "web_search") ? "\n- Always search the web when asked about current events, prices, or recent information" : ""}`;
}
