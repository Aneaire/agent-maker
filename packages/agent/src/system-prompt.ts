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

export function buildSystemPrompt(
  agentConfig: AgentConfig,
  memories: Memory[],
  tabs: Tab[] = [],
  customToolNames: string[] = [],
  conversationHistory: string = ""
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

  // ── Custom tools section (only if custom_http_tools is enabled) ─────
  const customToolSection =
    has(enabled, "custom_http_tools") && customToolNames.length > 0
      ? `\n\n## Custom Tools\nYou have these custom HTTP tools: ${customToolNames.join(", ")}\n`
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
  if (has(enabled, "custom_http_tools")) {
    capabilities.push(
      `- **Custom HTTP Tools** — call external APIs configured by your owner${customToolNames.length > 0 ? ` (${customToolNames.length} configured)` : ""}`
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

  return `${agentConfig.systemPrompt}${conversationHistory}${memorySection}${tabSection}${customToolSection}${capabilitiesSection}${autonomySection}${customToolGuidance}
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
