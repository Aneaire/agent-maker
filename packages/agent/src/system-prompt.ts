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
      "- **Memory** — store, recall, and semantically search information across conversations"
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
  if (has(enabled, "slack")) {
    capabilities.push(
      "- **Slack** — send messages, read channels, search messages, add reactions, and manage channel topics"
    );
  }
  if (has(enabled, "discord")) {
    capabilities.push(
      "- **Discord** — send messages, read channels, list servers, manage threads, and add reactions"
    );
  }
  if (has(enabled, "google_calendar")) {
    capabilities.push(
      "- **Google Calendar** — list events, create/update/delete events, check availability, and schedule meetings"
    );
  }
  if (has(enabled, "google_drive")) {
    capabilities.push(
      "- **Google Drive** — search, list, read, create, move, and delete files and folders"
    );
  }
  if (has(enabled, "google_sheets")) {
    capabilities.push(
      "- **Google Sheets** — create spreadsheets, read/write ranges, append rows, and manage sheet data"
    );
  }
  if (has(enabled, "image_generation")) {
    capabilities.push(
      "- **Image Generation** — generate images from text prompts using AI (Gemini Imagen or Nano Banana), saved to your asset library"
    );
  }
  if (has(enabled, "gmail")) {
    capabilities.push(
      "- **Gmail** — read, search, send, and reply to emails in the user's Gmail inbox; manage labels and threads"
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

  // ── Google Calendar guidelines ─────────────────────────────────────
  const gcalGuidance = has(enabled, "google_calendar")
    ? `
## Google Calendar
- Use \`gcal_list_events\` to check what's on the user's calendar — defaults to the next 7 days
- Use \`gcal_create_event\` to schedule meetings, reminders, or blocks — include timezone if the user has mentioned theirs
- Use \`gcal_find_free_time\` to check availability before suggesting meeting times
- Use \`gcal_update_event\` to reschedule or modify events (title, time, attendees, location)
- Use \`gcal_delete_event\` to cancel events
- Use \`gcal_list_calendars\` to find calendar IDs if the user has multiple calendars
- When the user says "schedule", "book", "set up a meeting", "block time", or "what's on my calendar", use the appropriate tool
- Always confirm times and attendees with the user before creating events with other people
- Set \`add_meet: true\` if the user asks for a video call or virtual meeting
`
    : "";

  // ── Google Drive guidelines ────────────────────────────────────────
  const gdriveGuidance = has(enabled, "google_drive")
    ? `
## Google Drive
- Use \`gdrive_search\` to find files by name or content
- Use \`gdrive_list_files\` to browse folder contents
- Use \`gdrive_read_file\` to read text content — works with Google Docs (exported as text), Sheets (as CSV), and plain text files
- Use \`gdrive_create_file\` to create Google Docs, Sheets, folders, or text files with optional initial content
- Use \`gdrive_move_file\` to rename or reorganize files into different folders
- Use \`gdrive_delete_file\` to trash files (recoverable from trash)
- When the user mentions a document or file, search for it first rather than asking for IDs
`
    : "";

  // ── Google Sheets guidelines ─────────────────────────────────────
  const gsheetsGuidance = has(enabled, "google_sheets")
    ? `
## Google Sheets
- Use \`gsheets_list_spreadsheets\` to list all Google Sheets spreadsheets in the user's Drive — always start here when the user asks to "list" or "find" spreadsheets
- Use \`gsheets_read\` to read data from a sheet range (A1 notation, e.g. "Sheet1!A1:D10" or just "Sheet1")
- Use \`gsheets_write\` to overwrite a specific range with new data
- Use \`gsheets_append\` to add new rows at the bottom of a sheet — ideal for logging, tracking, or accumulating data
- Use \`gsheets_create\` to create a new spreadsheet with optional sheet names and headers
- Use \`gsheets_get_info\` to see sheet names, row/column counts
- Use \`gsheets_clear\` to erase data from a range while keeping formatting
- When reading data, the first row is typically headers — use it to understand the column structure
- For A1 notation: "Sheet1!A1:C10" reads columns A-C rows 1-10, "Sheet1" reads the entire sheet
`
    : "";

  // ── Discord guidelines ──────────────────────────────────────────────
  const discordGuidance = has(enabled, "discord")
    ? `
## Discord Integration
- Use \`discord_list_guilds\` to find server IDs the bot is in
- Use \`discord_list_channels\` to find channel IDs within a server before sending messages
- Use \`discord_send_message\` to post to a channel (requires channel ID)
- Use \`discord_read_messages\` to check recent messages in a channel
- Use \`discord_add_reaction\` to react to messages with emoji (Unicode or custom)
- Use \`discord_create_thread\` to start a thread from a message or standalone
- Use \`discord_reply_in_thread\` to send a message in an existing thread
- When the user says "post to Discord" or "send a message in Discord", use discord_send_message
- Discord messages support markdown: **bold**, *italic*, ~~strike~~, \`code\`, > quote, \`\`\`code blocks\`\`\`
`
    : "";

  // ── Slack guidelines ───────────────────────────────────────────────
  const slackGuidance = has(enabled, "slack")
    ? `
## Slack Integration
- Use \`slack_list_channels\` to find channel IDs before sending messages
- Use \`slack_send_message\` to post to channels or reply to threads (provide thread_ts)
- Use \`slack_read_messages\` to check recent channel activity or read thread replies
- Use \`slack_search_messages\` to find specific messages across channels
- Use \`slack_add_reaction\` to react to messages with emoji
- Use \`slack_set_topic\` to update channel topics
- When the user says "post to Slack" or "notify the team", use slack_send_message
- Slack messages support mrkdwn formatting: *bold*, _italic_, ~strike~, \`code\`, > quote, bullet lists
`
    : "";

  // ── Gmail guidelines ───────────────────────────────────────────────
  const gmailGuidance = has(enabled, "gmail")
    ? `
## Gmail
- Use \`gmail_list_messages\` to check the inbox (supports label filters like INBOX, UNREAD, STARRED)
- Use \`gmail_search\` to find emails using Gmail's search syntax: \`from:alice\`, \`subject:invoice\`, \`is:unread\`, \`newer_than:2d\`, \`has:attachment\`
- Use \`gmail_get_message\` to read the full body and headers of a specific email
- Use \`gmail_get_thread\` to read an entire email conversation/thread
- Use \`gmail_send\` to compose and send a new email (supports HTML body, CC, BCC)
- Use \`gmail_reply\` to reply to an existing message — it automatically handles threading headers
- Use \`gmail_list_labels\` to discover label IDs before filtering or modifying
- Use \`gmail_modify_labels\` to archive (remove INBOX), star, mark as read/unread (remove UNREAD), or apply custom labels
- When the user says "check my email", "any new messages", "read my inbox" — use gmail_list_messages with label UNREAD
- When the user says "send an email to..." — use gmail_send
- When the user says "reply to..." — fetch the message first, then use gmail_reply
- Always confirm before sending or replying to emails
`
    : "";

  // ── Image Generation guidelines ─────────────────────────────────────
  const imageGenGuidance = has(enabled, "image_generation")
    ? `
## Image Generation
- Use \`generate_image\` to create images from detailed text prompts
- Write detailed, specific prompts: include style (photorealistic, watercolor, 3D render), subject details, composition, lighting, and mood
- The user will see a review panel where they can edit the prompt, choose the model, and select the aspect ratio before generating
- Write the best prompt you can — the user can refine it in the review panel
- Give each image a descriptive name — it's saved to the agent's Assets library for the user to browse
- Use \`list_assets\` to show the user their generated images
- You can specify a folder_id to organize images into folders
- When the user says "create an image", "generate a picture", "make me a visual", etc., use generate_image
- After calling generate_image, let the user know they can adjust settings in the review panel and click Generate when ready
- **Image editing**: When the user wants to edit or modify an existing image, pass its asset ID via \`input_asset_id\`. Only models marked with "img input" support this (e.g. Gemini Flash Image). Write the edit instructions as the prompt (e.g. "Make the sky purple and add stars"). Use \`list_assets\` first if you need to find the asset ID.
`
    : "";

  // ── Custom tools guidance (only if enabled) ─────────────────────────
  const customToolGuidance = has(enabled, "custom_http_tools")
    ? `
## Custom HTTP Tools
If the user asks you to do something you don't have a built-in tool for (e.g. connect to a specific API, access a database), do the following:

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

  // ── Available integrations (show what's NOT enabled yet) ────────────
  const allIntegrations: Record<string, { label: string; description: string }> = {
    memory: { label: "Memory", description: "Store and semantically recall information across conversations" },
    web_search: { label: "Web Search", description: "Search the internet and fetch web pages" },
    pages: { label: "Pages", description: "Create and manage task boards, notes, spreadsheets, and markdown pages" },
    rag: { label: "Knowledge Base", description: "Upload documents and search them for answers" },
    email: { label: "Email", description: "Send emails to users and contacts" },
    custom_http_tools: { label: "Custom HTTP Tools", description: "Call external APIs with custom configurations" },
    schedules: { label: "Scheduled Actions", description: "Create recurring or one-time scheduled tasks" },
    automations: { label: "Automations", description: "Event-driven rules: when X happens → do Y" },
    timers: { label: "Timers & Delays", description: "Set delayed actions for follow-ups and reminders" },
    webhooks: { label: "Webhooks", description: "Fire outgoing webhooks to external services" },
    agent_messages: { label: "Inter-Agent Messaging", description: "Communicate with other agents for delegation" },
    notion: { label: "Notion", description: "Search, read, create, and update Notion pages and databases" },
    slack: { label: "Slack", description: "Send messages, read channels, and search in Slack" },
    discord: { label: "Discord", description: "Send messages, read channels, manage threads, and react in Discord" },
    google_calendar: { label: "Google Calendar", description: "Schedule meetings, check availability, manage events" },
    google_drive: { label: "Google Drive", description: "Search, read, create, and manage files in Google Drive" },
    google_sheets: { label: "Google Sheets", description: "Read, write, and manage spreadsheet data" },
    image_generation: { label: "Image Generation", description: "Generate images from text prompts using AI" },
    gmail: { label: "Gmail", description: "Read, search, send, and reply to emails in Gmail" },
  };

  const disabledIntegrations = Object.entries(allIntegrations)
    .filter(([key]) => !has(enabled, key))
    .map(([, info]) => `- **${info.label}** — ${info.description}`);

  const availableIntegrationsSection = disabledIntegrations.length > 0
    ? `
## Available Integrations (Not Yet Enabled)
The following integrations are available but not currently enabled for you. If the user asks about any of these capabilities, let them know it's available and they can enable it:

${disabledIntegrations.join("\n")}

To enable these, tell the user: *"This integration is available! You can enable it in the **Settings** page of the HiGantic dashboard under **Tool Sets**."*
If the user wants more details, point them to the documentation page in the HiGantic dashboard.
`
    : "";

  return `${agentConfig.systemPrompt}${conversationHistory}${memorySection}${tabSection}${knowledgeBaseSection}${customToolSection}${schedulesSection}${automationsSection}${capabilitiesSection}${autonomySection}${scheduleGuidance}${automationGuidance}${agentMessageGuidance}${notionGuidance}${slackGuidance}${discordGuidance}${gcalGuidance}${gdriveGuidance}${gsheetsGuidance}${gmailGuidance}${imageGenGuidance}${customToolGuidance}${availableIntegrationsSection}
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
